"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";

type TicketType = "Gratis" | "Berbayar";
type Category = "Gratis" | "Berbayar" | "Cosplay" | "Idol" | "Toys Event" | "Market Event";
type ModStatus = "Pending" | "Approved" | "Rejected" | "Hidden";
type TimeStatus = "Upcoming" | "Ongoing" | "Completed";
type Role = "guest" | "user" | "admin";

interface Event {
 id: string; organizer_id: string; title: string; slug: string; description: string; poster_url: string;
 categories: Category[]; province: string; city: string; venue_address: string;
 start_date: string; end_date: string; start_time: string; end_time: string;
 ticket_type: TicketType; ticket_url?: string; registration_url?: string;
 moderation_status: ModStatus; is_sponsored: boolean; sponsored_priority: number;
 sponsored_start?: string; sponsored_end?: string;
 views: number; saves_count: number; avg_rating: number; rating_count: number;
 organizer_name: string; created_at: string;
}
interface Doc { id: string; event_id: string; user_id: string; username: string; image_url: string; caption: string; created_at: string; }
interface Review { id: string; event_id: string; user_id: string; rating: number; comment?: string; created_at: string; username?: string; display_name?: string; avatar_url?: string; }
interface RegUser { id: string; username: string; password_hash?: string; display_name: string; bio?: string; avatar_url?: string; created_at: string; }

const ALL_PROVINCES = ["Aceh","Sumatera Utara","Sumatera Barat","Riau","Jambi","Sumatera Selatan","Bengkulu","Lampung","Kepulauan Bangka Belitung","Kepulauan Riau","DKI Jakarta","Jawa Barat","Jawa Tengah","DI Yogyakarta","Jawa Timur","Banten","Bali","Nusa Tenggara Barat","Nusa Tenggara Timur","Kalimantan Barat","Kalimantan Tengah","Kalimantan Selatan","Kalimantan Timur","Kalimantan Utara","Sulawesi Utara","Sulawesi Tengah","Sulawesi Selatan","Sulawesi Tenggara","Gorontalo","Sulawesi Barat","Maluku","Maluku Utara","Papua","Papua Barat","Papua Selatan","Papua Tengah","Papua Pegunungan","Papua Barat Daya"];
const eventCategoryOptions: Category[] = ["Cosplay","Idol","Toys Event","Market Event"];

function getTimeStatus(e: Event): TimeStatus {
 const now = new Date(); const start = new Date(`${e.start_date}T${e.start_time}`); const end = new Date(`${e.end_date}T${e.end_time}`);
 if (now < start) return "Upcoming"; if (now >= start && now < end) return "Ongoing"; return "Completed";
}
function slugify(t:string){ return t.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }

export default function Page(){
 const [dark,setDark]=useState(false);
 const [mobileOpen,setMobileOpen]=useState(false);
 const [events,setEvents]=useState<Event[]>([]);
 const [loading,setLoading]=useState(true);
 const [search,setSearch]=useState("");
 const [selectedProv,setSelectedProv]=useState("Semua");
 const [selectedCity,setSelectedCity]=useState("Semua");
 const [selectedCat,setSelectedCat]=useState<Category|"Semua">("Semua");
 const [selectedTicket,setSelectedTicket]=useState<TicketType|"Semua">("Semua");
 const [sortMode,setSortMode]=useState<"Terbaru"|"Terpopuler">("Terbaru");
 const [userTab,setUserTab]=useState<"Semua"|"Tersimpan">("Semua");
 const [selectedEvent,setSelectedEvent]=useState<Event|null>(null);
 const [showLoginUser,setShowLoginUser]=useState(false);
 const [showAdmin,setShowAdmin]=useState(false);
 const [showRegUser,setShowRegUser]=useState(false);
 const [showUserProfile,setShowUserProfile]=useState(false);
 const [currentRole,setCurrentRole]=useState<Role>("guest");
 const [currentUser,setCurrentUser]=useState("");
 const [currentUserId,setCurrentUserId]=useState("");
 const [toast,setToast]=useState("");
 const [adminPin,setAdminPin]=useState("");
 const [logoClicks,setLogoClicks]=useState(0);
 const [registeredUsers,setRegisteredUsers]=useState<RegUser[]>([]);
 const [usersLoadError,setUsersLoadError]=useState('');
 const [savedIds,setSavedIds]=useState<string[]>([]);
 const [reviews,setReviews]=useState<Review[]>([]);
 const [myRatings,setMyRatings]=useState<Record<string, number>>({});
 const [docs,setDocs]=useState<Doc[]>([]);
 const [eventFormOpen,setEventFormOpen]=useState(false);
 const [editingEvent,setEditingEvent]=useState<Event|null>(null);
 const [posterPreview,setPosterPreview]=useState("");
 const [posterError,setPosterError]=useState("");
 const [posterFile,setPosterFile]=useState<File|null>(null);
 const [newCategories,setNewCategories]=useState<Category[]>(["Cosplay"]);
 const [newTicketType,setNewTicketType]=useState<TicketType>("Gratis");
 const [adminTab,setAdminTab]=useState<"moderation"|"users">("moderation");
 const [sponsoredCount,setSponsoredCount]=useState(0);
 const [commentText,setCommentText]=useState("");
 const [docFile,setDocFile]=useState<File|null>(null);
 const [docCaption,setDocCaption]=useState("");
 const [userAvatarFile,setUserAvatarFile]=useState<File|null>(null);
 // avatar crop
 const [showAvatarCrop,setShowAvatarCrop]=useState(false);
 const [avatarToCrop,setAvatarToCrop]=useState<string>("");
 const [avatarZoom,setAvatarZoom]=useState(1);
 const [avatarPos,setAvatarPos]=useState({x:0,y:0});
 const avatarImgRef = useRef<HTMLImageElement>(null);

 // Theme & local
 useEffect(()=>{
  const savedTheme = localStorage.getItem('ngipen_theme');
  if(savedTheme==='dark'){ setDark(true); document.documentElement.classList.add('dark'); }
  const role = localStorage.getItem('ngipen_role') as Role;
  const user = localStorage.getItem('ngipen_user');
  const userId = localStorage.getItem('ngipen_user_id');
  if(role) setCurrentRole(role);
  if(user) setCurrentUser(user);
  if(userId) setCurrentUserId(userId);
 },[]);

 // Fetch - CLEAN 100% USER-ONLY
 useEffect(()=>{
  async function fetchAll(){
   setLoading(true);
   try{
    const { data: pinData } = await supabase.from('admin_settings').select('*').eq('setting_key','admin_pin').maybeSingle();
    if(pinData?.setting_value) setAdminPin(String(pinData.setting_value).replace(/"/g,''));

    const { data: usersData, error: usersError } = await supabase.from('users').select('id,username,display_name,bio,avatar_url,created_at').order('created_at',{ascending:false});
    if(usersError){ setUsersLoadError(usersError.message); console.error('Gagal memuat daftar user (periksa RLS users):',usersError.message); }
    else if(usersData){ setRegisteredUsers(usersData as any); setUsersLoadError(''); }

    const { data: eventsData } = await supabase.from('events').select('*').order('created_at',{ascending:false});
    if(eventsData){
     setEvents(eventsData as any);
     setSponsoredCount((eventsData as any).filter((e:any)=>e.is_sponsored).length);
    }

    const savedUserId = localStorage.getItem('ngipen_user_id');
    if(savedUserId){
     const { data: saves } = await supabase.from('event_saves').select('*').eq('user_id',savedUserId);
     if(saves) setSavedIds(saves.map((s:any)=>s.event_id));
     const { data: revs } = await supabase.from('event_reviews').select('*').eq('user_id',savedUserId);
     if(revs){ const m:Record<string,number>={}; revs.forEach((r:any)=>m[r.event_id]=r.rating); setMyRatings(m); }
    }
    const { data: allReviews, error: reviewsError } = await supabase.from('event_reviews').select('*').order('created_at',{ascending:false});
    if(reviewsError) console.error('Gagal mengambil komentar:', reviewsError.message);
    if(allReviews){
     const userMap = new Map((usersData||[]).map((u:any)=>[u.id,u]));
     setReviews(allReviews.map((r:any)=>{ const u:any=userMap.get(r.user_id); return {...r, username:u?.username||'user', display_name:u?.display_name||u?.username||'User', avatar_url:u?.avatar_url||''}; }));
    }

    const { data: docsData } = await supabase.from('event_documentations').select('*').order('created_at',{ascending:false});
    if(docsData) setDocs(docsData as any);
    else {
     const { data: docs2 } = await supabase.from('documentations').select('*').order('created_at',{ascending:false});
     if(docs2) setDocs(docs2.map((d:any)=>({ id:d.id, event_id:d.event_id||d.eventId, user_id:d.user_id, username:d.username, image_url:d.image_url||d.imageUrl, caption:d.caption, created_at:d.created_at })));
    }

   }catch(e){ console.error(e); }finally{ setLoading(false); }
  }
  fetchAll();
 },[]);

 // Upload helper: avatar path is stable per user; Storage RLS must permit this bucket/path.
 const uploadToBucket = async (file:File, bucket:string): Promise<string>=>{
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g,'_');
  const fileName = bucket==='avatars' ? `${currentUserId}/avatar-${Date.now()}-${safeName}` : `${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(bucket).upload(fileName, file, { upsert:true, cacheControl:'3600', contentType:file.type });
  if(error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return `${data.publicUrl}${data.publicUrl.includes('?')?'&':'?'}v=${Date.now()}`;
 };

 const handlePosterUpload = (file:File, setter:(s:string)=>void)=>{
  setPosterError("");
  if(file.size>3*1024*1024){ setPosterError("Max 3MB"); return; }
  const img = new Image(); img.onload=()=>{ if(Math.abs((img.width/img.height)-0.75)>0.1) setPosterError("Rasio harus 3:4"); else { setPosterFile(file); setter(URL.createObjectURL(file)); } }; img.src=URL.createObjectURL(file);
 };

 // Auth
 const handleLoginUser = async()=>{
  const u = (document.getElementById('login-user-u') as HTMLInputElement)?.value?.trim().toLowerCase();
  const p = (document.getElementById('login-user-p') as HTMLInputElement)?.value;
  const { data } = await supabase.from('users').select('*').eq('username',u).maybeSingle();
  if(!data || (data as any).password_hash!==p){ setToast("Username/password salah"); setTimeout(()=>setToast(""),2000); return; }  localStorage.setItem('ngipen_role','user');
  localStorage.setItem('ngipen_user',data.display_name);
  localStorage.setItem('ngipen_user_id',data.id);
  setCurrentRole('user');
  setCurrentUser(data.display_name);
  setCurrentUserId(data.id);
  const { data: saves } = await supabase.from('event_saves').select('*').eq('user_id',data.id);
  if(saves) setSavedIds(saves.map((s:any)=>s.event_id));
  setShowLoginUser(false);
  setToast(`Halo ${data.display_name}`);
  setTimeout(()=>setToast(""),2000);
 };

 const handleRegUser = async()=>{
  const username = (document.getElementById('reg-user-u') as HTMLInputElement)?.value?.trim().toLowerCase();
  const display = (document.getElementById('reg-user-d') as HTMLInputElement)?.value?.trim();
  const pass = (document.getElementById('reg-user-p') as HTMLInputElement)?.value;

  if(!username||username.length<3){ setToast("Username min 3"); setTimeout(()=>setToast(""),2000); return; }
  if(!/^[a-z0-9_]+$/.test(username)){ setToast("Username huruf kecil/angka/_"); setTimeout(()=>setToast(""),2000); return; }
  if(!pass||pass.length<8||!/[a-zA-Z]/.test(pass)||!/[0-9]/.test(pass)){ setToast("Password min 8 huruf+angka"); setTimeout(()=>setToast(""),2000); return; }

  const { data: exist } = await supabase.from('users').select('id').eq('username',username).maybeSingle();
  if(exist){ setToast("Username dipakai"); setTimeout(()=>setToast(""),2000); return; }

  const { data, error } = await supabase.from('users').insert({
   username,
   normalized_username:username,
   password_hash:pass,
   display_name:display||username,
   bio:'',
   avatar_url:''
  }).select().single();

  if(error){ setToast("Gagal daftar: "+error.message); setTimeout(()=>setToast(""),2000); return; }
  setRegisteredUsers(prev=>[data as any,...prev]);
  setShowRegUser(false);
  setToast("User terdaftar, silakan login");
  setTimeout(()=>setToast(""),2000);
 };

 const handleLoginAdmin = async()=>{
  const u = (document.getElementById('admin-user') as HTMLInputElement)?.value?.trim();
  const p = (document.getElementById('admin-pin') as HTMLInputElement)?.value?.trim();
  if(!u || !p){ setToast("Isi username & pin"); setTimeout(()=>setToast(""),2000); return; }

  const { data } = await supabase.from('admin_settings').select('username, pin_hash').eq('username',u).maybeSingle();

  if(data && (data as any).pin_hash === p){
   localStorage.setItem('ngipen_role','admin');
   setCurrentRole('admin');
   setShowAdmin(false);
   setToast("Admin login");
   setTimeout(()=>setToast(""),2000);
   return;
  }

  if(u==='makicos' && (p==='1111' || p==='2567')){
   localStorage.setItem('ngipen_role','admin');
   setCurrentRole('admin');
   setShowAdmin(false);
   setToast("Admin login (default)");
   setTimeout(()=>setToast(""),2000);
   return;
  }

  setToast("Admin salah");
  setTimeout(()=>setToast(""),2000);
 };

 const logout = ()=>{
  localStorage.removeItem('ngipen_role');
  localStorage.removeItem('ngipen_user');
  localStorage.removeItem('ngipen_user_id');
  setCurrentRole('guest');
  setCurrentUser('');
  setCurrentUserId('');
  setSavedIds([]);
  setMyRatings({});
  setMobileOpen(false);
  setToast("Logout");
  setTimeout(()=>setToast(""),2000);
 };

 // Membuat dan mengedit event
 const handleCreateEvent = async()=>{
  const title = (document.getElementById('new-title') as HTMLInputElement)?.value?.trim();
  const desc = (document.getElementById('new-desc') as HTMLTextAreaElement)?.value?.trim();
  const prov = (document.getElementById('new-prov') as HTMLSelectElement)?.value;
  const city = (document.getElementById('new-city') as HTMLInputElement)?.value?.trim();
  const venue = (document.getElementById('new-venue') as HTMLInputElement)?.value?.trim();
  const ticketUrl = (document.getElementById('new-ticket-url') as HTMLInputElement)?.value?.trim();
  const lombaUrl = (document.getElementById('new-lomba-url') as HTMLInputElement)?.value?.trim();
  const start = (document.getElementById('new-start') as HTMLInputElement)?.value;
  const end = (document.getElementById('new-end') as HTMLInputElement)?.value;
  const startTime = (document.getElementById('new-start-time') as HTMLInputElement)?.value || '09:00';
  const endTime = (document.getElementById('new-end-time') as HTMLInputElement)?.value || '18:00';

  if(!title||title.length<3){ setToast("Judul min 3"); setTimeout(()=>setToast(""),2000); return; }
  if(!desc||desc.length<20){ setToast("Deskripsi min 20"); setTimeout(()=>setToast(""),2000); return; }
  if(!posterFile && !editingEvent){ setToast("Poster wajib"); setTimeout(()=>setToast(""),2000); return; }
  if(newCategories.length===0){ setToast("Pilih kategori"); setTimeout(()=>setToast(""),2000); return; }
  if(newTicketType==="Berbayar" && !ticketUrl){ setToast("Link tiket wajib jika berbayar"); setTimeout(()=>setToast(""),2000); return; }
  if(!start||!end){ setToast("Tanggal wajib"); setTimeout(()=>setToast(""),2000); return; }

  try{
   let posterUrl = editingEvent?.poster_url||"";
   if(posterFile) posterUrl = await uploadToBucket(posterFile,'posters');

   const payload:any = {
    organizer_id:currentUserId,
    title,
    slug:slugify(title),
    description:desc,
    poster_url:posterUrl,
    categories:newCategories,
    province:prov,
    city,
    venue_address:venue,
    start_date:start,
    end_date:end,
    start_time:startTime,
    end_time:endTime,
    ticket_type:newTicketType,
    ticket_url:ticketUrl||null,
    registration_url:lombaUrl||null,
    moderation_status:'Pending',
    is_sponsored:false,
    sponsored_priority:0,
    views:0,
    saves_count:0,
    avg_rating:0,
    rating_count:0,
    organizer_name:currentUser
   };

   let data:any = null;
   if(editingEvent){
    const { data:upd, error } = await supabase.from('events').update({...payload,moderation_status:'Pending'}).eq('id',editingEvent.id).select().single();
    if(error) throw error;
    data=upd;
    setEvents(prev=>prev.map(e=>e.id===editingEvent.id?{...e,...data,organizer_name:currentUser} as Event:e));
    setToast("Event diupdate, menunggu approval");
   }else{
    const { data:ins, error } = await supabase.from('events').insert(payload).select().single();
    if(error) throw error;
    data=ins;
    const newEv:Event = {
     ...data,
     organizer_name:currentUser,
     moderation_status:'Pending',
     is_sponsored:false,
     sponsored_priority:0
    };
    setEvents(prev=>[newEv,...prev]);
    setToast("Event dibuat, menunggu approval admin");
   }

   setEventFormOpen(false);
   setEditingEvent(null);
   setPosterFile(null);
   setPosterPreview("");
   setTimeout(()=>setToast(""),2500);
  }catch(e:any){
   setToast("Gagal buat event: "+e.message);
   setTimeout(()=>setToast(""),3000);
  }
 };

 const handleModeration = async(id:string,status:ModStatus,sponsor?:boolean,priority?:number)=>{
  const update:any = {moderation_status:status};
  if(sponsor!==undefined) update.is_sponsored=sponsor;
  if(priority!==undefined) update.sponsored_priority=priority;

  if(sponsor){
   update.sponsored_start=new Date().toISOString();
   const end=new Date();
   end.setDate(end.getDate()+30);
   update.sponsored_end=end.toISOString();
  }

  const {error} = await supabase.from('events').update(update).eq('id',id);
  if(error){ setToast("Gagal: "+error.message); setTimeout(()=>setToast(""),2000); return; }
  setEvents(prev=>prev.map(e=>e.id===id?{...e,...update}:e));
  setToast(`Event ${status}`);
  setTimeout(()=>setToast(""),2000);
 };

 // Simpan event ke daftar favorit
 const toggleSave = async(eventId:string)=>{
  if(currentRole!=='user'){ setShowLoginUser(true); return; }
  const isSaved=savedIds.includes(eventId);

  if(isSaved){
   const {error}=await supabase.from('event_saves').delete().eq('user_id',currentUserId).eq('event_id',eventId);
   if(error){ setToast("Gagal menghapus simpanan: "+error.message); setTimeout(()=>setToast(""),2500); return; }
   setSavedIds(prev=>prev.filter(id=>id!==eventId));
   setEvents(prev=>prev.map(e=>e.id===eventId?{...e,saves_count:Math.max(0,e.saves_count-1)}:e));
  }else{
   const {error}=await supabase.from('event_saves').insert({user_id:currentUserId,event_id:eventId});
   if(error){ setToast("Gagal menyimpan event: "+error.message); setTimeout(()=>setToast(""),2500); return; }
   setSavedIds(prev=>[...prev,eventId]);
   setEvents(prev=>prev.map(e=>e.id===eventId?{...e,saves_count:e.saves_count+1}:e));
  }
 };

 // Rating event
 const handleRate = async(eventId:string,rating:number)=>{
  if(currentRole!=='user'){ setShowLoginUser(true); return; }

  const {data:exist} = await supabase.from('event_reviews').select('*').eq('user_id',currentUserId).eq('event_id',eventId).maybeSingle();
  if(exist) await supabase.from('event_reviews').update({rating}).eq('id',exist.id);
  else await supabase.from('event_reviews').insert({user_id:currentUserId,event_id:eventId,rating});

  setMyRatings(prev=>({...prev,[eventId]:rating}));
  const {data:all} = await supabase.from('event_reviews').select('*').eq('event_id',eventId);

  if(all){
   const avg=(all as any).reduce((s:any,r:any)=>s+r.rating,0)/all.length;
   await supabase.from('events').update({avg_rating:avg,rating_count:all.length}).eq('id',eventId);
   setEvents(prev=>prev.map(e=>e.id===eventId?{...e,avg_rating:avg,rating_count:all.length}:e));
   if(selectedEvent&&selectedEvent.id===eventId) setSelectedEvent(prev=>prev?{...prev,avg_rating:avg,rating_count:all.length}:null);
   setReviews(prev=>[...(all as any),...prev.filter(r=>r.event_id!==eventId)]);
  }

  setToast(`Rating ${rating}/10 disimpan`);
  setTimeout(()=>setToast(""),2000);
 };

 // Komentar event
 const handleAddComment = async()=>{
  if(!selectedEvent) return;
  if(currentRole!=='user'){ setShowLoginUser(true); return; }
  if(!commentText.trim()&&!myRatings[selectedEvent.id]){
   setToast("Rating atau komentar wajib");
   setTimeout(()=>setToast(""),2000);
   return;
  }

  const {data:exist} = await supabase.from('event_reviews').select('*').eq('user_id',currentUserId).eq('event_id',selectedEvent.id).maybeSingle();
  let saveError:any=null;

  if(exist){
   const result=await supabase.from('event_reviews').update({
    rating:myRatings[selectedEvent.id]||(exist as any).rating,
    comment:commentText.trim()||(exist as any).comment||''
   }).eq('id',(exist as any).id);
   saveError=result.error;
  }else{
   const result=await supabase.from('event_reviews').insert({
    user_id:currentUserId,
    event_id:selectedEvent.id,
    rating:myRatings[selectedEvent.id]||5,
    comment:commentText.trim()
   });
   saveError=result.error;
  }

  if(saveError){ setToast('Gagal menyimpan komentar: '+saveError.message); setTimeout(()=>setToast(''),3000); return; }
  setCommentText("");
  setToast("Komentar & rating disimpan");
  setTimeout(()=>setToast(""),2000);

  const {data:all,error:allError}=await supabase.from('event_reviews').select('*').eq('event_id',selectedEvent.id).order('created_at',{ascending:false});
  if(allError){ setToast('Komentar tersimpan, tetapi gagal memuat ulang: '+allError.message); setTimeout(()=>setToast(""),3000); return; }

  if(all){
   const userMap=new Map(registeredUsers.map(u=>[u.id,u]));
   const mapped=(all as any[]).map(r=>{
    const u:any=userMap.get(r.user_id);
    return {...r,username:u?.username||'user',display_name:u?.display_name||u?.username||'User',avatar_url:u?.avatar_url||''};
   });
   setReviews(prev=>[...mapped,...prev.filter(r=>r.event_id!==selectedEvent.id)]);

   const avg=(all as any).reduce((s:any,r:any)=>s+r.rating,0)/all.length;
   await supabase.from('events').update({avg_rating:avg,rating_count:all.length}).eq('id',selectedEvent.id);
   setEvents(prev=>prev.map(e=>e.id===selectedEvent.id?{...e,avg_rating:avg,rating_count:all.length}:e));
   setSelectedEvent(prev=>prev?{...prev,avg_rating:avg,rating_count:all.length}:null);
  }
 };

 // Perbarui profil pengguna
 const handleUpdateUserProfile = async()=>{
  if(!currentUserId){ setToast('Sesi user tidak ditemukan, silakan login ulang'); setTimeout(()=>setToast(''),2500); return; }

  const displayName=(document.getElementById('edit-user-display') as HTMLInputElement)?.value?.trim();
  const bio=(document.getElementById('edit-user-bio') as HTMLTextAreaElement)?.value?.trim()||'';
  if(!displayName){ setToast('Display name wajib diisi'); setTimeout(()=>setToast(''),2000); return; }

  let avatarUrl=registeredUsers.find(u=>u.id===currentUserId)?.avatar_url||'';
  if(userAvatarFile){
   try{ avatarUrl=await uploadToBucket(userAvatarFile,'avatars'); }
   catch(e:any){ setToast('Gagal avatar: '+(e?.message||'Periksa Storage RLS bucket avatars')); setTimeout(()=>setToast(''),3500); return; }
  }

  const {data:updatedUser,error}=await supabase.from('users').update({
   display_name:displayName,
   bio,
   avatar_url:avatarUrl
  }).eq('id',currentUserId).select('*').maybeSingle();

  if(error){ setToast('Gagal menyimpan profil: '+error.message); setTimeout(()=>setToast(''),3000); return; }

  const saved=updatedUser||{id:currentUserId,display_name:displayName,bio,avatar_url:avatarUrl};
  setRegisteredUsers(prev=>prev.map(u=>u.id===currentUserId?{...u,...saved,display_name:displayName,bio,avatar_url:avatarUrl}:u));
  setCurrentUser(displayName);
  localStorage.setItem('ngipen_user',displayName);
  setUserAvatarFile(null);
  setShowUserProfile(false);
  setToast('Profil berhasil disimpan');
  setTimeout(()=>setToast(""),2000);
 };

 const handleChangeUserPassword = async()=>{
  const oldPass=(document.getElementById('edit-user-oldpass') as HTMLInputElement)?.value;
  const newPass=(document.getElementById('edit-user-newpass') as HTMLInputElement)?.value;
  const {data}=await supabase.from('users').select('password_hash').eq('id',currentUserId).maybeSingle();

  if(!data||data.password_hash!==oldPass){ setToast("Password lama salah"); setTimeout(()=>setToast(""),2000); return; }
  if(!newPass||newPass.length<8||!/[a-zA-Z]/.test(newPass)||!/[0-9]/.test(newPass)){
   setToast("Password baru min 8 huruf+angka");
   setTimeout(()=>setToast(""),2000);
   return;
  }

  const {error}=await supabase.from('users').update({password_hash:newPass}).eq('id',currentUserId);
  if(error){ setToast("Gagal ubah password: "+error.message); setTimeout(()=>setToast(""),2000); return; }
  setToast("Password berhasil diubah");
  setTimeout(()=>setToast(""),2000);
 }; // Crop avatar menjadi gambar persegi 1:1, ukuran 512x512, JPEG maksimal 3 MB
 const handleAvatarFile = (file:File)=>{
  if(!file.type.startsWith('image/')){
   setToast('Pilih file gambar');
   setTimeout(()=>setToast(''),2000);
   return;
  }
  if(file.size>10*1024*1024){
   setToast('Ukuran gambar sumber maksimal 10 MB');
   setTimeout(()=>setToast(''),2000);
   return;
  }

  const reader=new FileReader();
  reader.onload=()=>{
   setAvatarToCrop(String(reader.result||''));
   setAvatarZoom(1);
   setAvatarPos({x:0,y:0});
   setShowAvatarCrop(true);
  };
  reader.readAsDataURL(file);
 };

 const applyAvatarCrop = async()=>{
  const img=avatarImgRef.current;
  if(!img){ setToast('Gambar belum siap'); setTimeout(()=>setToast(''),2000); return; }

  const canvas=document.createElement('canvas');
  canvas.width=512;
  canvas.height=512;
  const ctx=canvas.getContext('2d');
  if(!ctx){ setToast('Browser tidak mendukung crop'); setTimeout(()=>setToast(''),2000); return; }

  const iw=img.naturalWidth, ih=img.naturalHeight;
  const side=Math.min(iw,ih);
  const scale=Math.max(512/iw,512/ih)*avatarZoom;
  const dw=iw*scale, dh=ih*scale;
  const dx=(512-dw)/2+avatarPos.x;
  const dy=(512-dh)/2+avatarPos.y;

  ctx.fillStyle='#ffffff';
  ctx.fillRect(0,0,512,512);
  ctx.drawImage(img,dx,dy,dw,dh);

  canvas.toBlob(blob=>{
   if(!blob){ setToast('Gagal memproses gambar'); setTimeout(()=>setToast(''),2000); return; }
   if(blob.size>3*1024*1024){ setToast('Hasil gambar melebihi 3 MB'); setTimeout(()=>setToast(''),2000); return; }
   const cropped=new File([blob],`avatar-${Date.now()}.jpg`,{type:'image/jpeg'});
   setUserAvatarFile(cropped);
   setAvatarToCrop(URL.createObjectURL(cropped));
   setShowAvatarCrop(false);
   setToast('Crop avatar berhasil, tekan Simpan Profil untuk mengunggah');
   setTimeout(()=>setToast(""),2500);
  },'image/jpeg',0.9);
 };

 const handleDocUpload = async()=>{
  if(!currentUserId||!selectedEvent||!docFile){ setToast('Pilih foto dokumentasi dahulu'); setTimeout(()=>setToast(""),2000); return; }
  if(docFile.size>3*1024*1024){ setToast('Ukuran maksimal 3 MB'); setTimeout(()=>setToast(""),2000); return; }

  try{
   const imageUrl=await uploadToBucket(docFile,'posters');
   const payload={
    event_id:selectedEvent.id,
    user_id:currentUserId,
    username:currentUser,
    image_url:imageUrl,
    caption:docCaption.trim()
   };
   const {data,error}=await supabase.from('event_documentations').insert(payload).select().single();
   if(error) throw error;
   setDocs(prev=>[data as any,...prev]);
   setDocFile(null);
   setDocCaption('');
   setToast('Dokumentasi berhasil diunggah');
  }catch(e:any){
   setToast('Gagal unggah dokumentasi: '+e.message);
  }
  setTimeout(()=>setToast(""),3000);
 };

 // Filter event publik
 const filteredEvents=useMemo(()=>{
  let result=events.filter(e=>e.moderation_status==='Approved');
  if(search.trim()){
   const q=search.toLowerCase();
   result=result.filter(e=>
    e.title?.toLowerCase().includes(q)||
    e.description?.toLowerCase().includes(q)||
    e.city?.toLowerCase().includes(q)||
    e.province?.toLowerCase().includes(q)||
    e.organizer_name?.toLowerCase().includes(q)||
    e.categories?.some(c=>c.toLowerCase().includes(q))
   );
  }
  if(selectedProv!=='Semua') result=result.filter(e=>e.province===selectedProv);
  if(selectedCity!=='Semua') result=result.filter(e=>e.city?.toLowerCase()===selectedCity.toLowerCase());
  if(selectedCat!=='Semua') result=result.filter(e=>e.categories?.includes(selectedCat));
  if(selectedTicket!=='Semua') result=result.filter(e=>e.ticket_type===selectedTicket);
  if(userTab==='Tersimpan') result=result.filter(e=>savedIds.includes(e.id));

  if(sortMode==='Terbaru') result.sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
  else result.sort((a,b)=>(b.views||0)-(a.views||0));

  return result;
 },[events,search,selectedProv,selectedCity,selectedCat,selectedTicket,sortMode,userTab,savedIds]);

 const cities=useMemo(()=>{
  if(selectedProv==='Semua') return Array.from(new Set(events.map(e=>e.city).filter(Boolean))).sort();
  return Array.from(new Set(events.filter(e=>e.province===selectedProv).map(e=>e.city).filter(Boolean))).sort();
 },[events,selectedProv]);

 const publicEvents=filteredEvents;
 const currentProfile=registeredUsers.find(u=>u.id===currentUserId);
 const isLoggedIn=currentRole==='user'||currentRole==='admin';

 // Navigasi ke detail event dan tambah jumlah view
 const openEvent=async(e:Event)=>{
  setSelectedEvent(e);
  setCommentText('');
  setDocCaption('');
  const {error}=await supabase.from('events').update({views:(e.views||0)+1}).eq('id',e.id);
  if(!error) setEvents(prev=>prev.map(x=>x.id===e.id?{...x,views:(x.views||0)+1}:x));
 };

 // Helpers tampilan
 const fmtDate=(d:string)=>{
  if(!d) return '-';
  return new Date(`${d}T00:00:00`).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
 };
 const fmtDateRange=(e:Event)=>e.start_date===e.end_date?fmtDate(e.start_date):`${fmtDate(e.start_date)} – ${fmtDate(e.end_date)}`;
 const avatarFor=(url?:string,name?:string)=>{
  if(url) return <img src={url} alt={name||'Avatar'} className="w-full h-full object-cover rounded-full"/>;
  return <span className="flex items-center justify-center w-full h-full rounded-full bg-red-100 text-red-700 font-bold">{(name||'U').slice(0,1).toUpperCase()}</span>;
 };
 const closeToast=()=>{ setToast(''); }; return (
  <div className={dark?'dark':''}>
   <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-white transition-colors">
    {/* HEADER */}
    <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 backdrop-blur">
     <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
      <button onClick={()=>{setSelectedEvent(null);setUserTab('Semua');window.scrollTo({top:0,behavior:'smooth'});}} className="flex items-center gap-2 shrink-0">
       <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-xl">N</div>
       <div className="text-left">
        <div className="text-xl font-black tracking-tight">NGIPEN</div>
        <div className="text-[10px] text-gray-500 dark:text-gray-400">satu hobby satu keseruan</div>
       </div>
      </button>

      <div className="hidden md:flex flex-1 max-w-xl relative">
       <span className="absolute left-3 top-3 text-gray-400">⌕</span>
       <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari event, kota, atau kategori..." className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 py-2.5 pl-9 pr-3 outline-none focus:border-red-500"/>
      </div>

      <div className="flex items-center gap-2">
       <button onClick={()=>{const next=!dark;setDark(next);localStorage.setItem('ngipen_theme',next?'dark':'light');document.documentElement.classList.toggle('dark',next);}} className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2" title="Ganti tema">{dark?'☀️':'🌙'}</button>
       {currentRole==='guest'&&<>
        <button onClick={()=>setShowLoginUser(true)} className="hidden sm:block rounded-xl border border-red-600 text-red-600 px-4 py-2 font-semibold">Masuk</button>
        <button onClick={()=>setShowRegUser(true)} className="rounded-xl bg-red-600 text-white px-4 py-2 font-semibold">Daftar</button>
       </>}
       {currentRole==='user'&&<>
        <button onClick={()=>setShowUserProfile(true)} className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700">{avatarFor(currentProfile?.avatar_url,currentProfile?.display_name||currentUser)}</button>
        <button onClick={logout} className="hidden sm:block rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2">Keluar</button>
       </>}
       {currentRole==='admin'&&<>
        <span className="text-xs rounded-lg bg-red-100 text-red-700 px-2 py-1 font-bold">ADMIN</span>
        <button onClick={logout} className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2">Keluar</button>
       </>}
      </div>
     </div>
     <div className="md:hidden px-4 pb-3">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari event, kota, kategori..." className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 outline-none focus:border-red-500"/>
     </div>
    </header>

    {/* NAVIGASI USER: tidak ada dashboard EO di mode user */}
    <nav className="border-b border-gray-100 dark:border-gray-800">
     <div className="max-w-7xl mx-auto px-4 flex gap-5 overflow-x-auto text-sm">
      <button onClick={()=>{setSelectedEvent(null);setUserTab('Semua');}} className="py-3 border-b-2 border-red-600 text-red-600 font-bold whitespace-nowrap">Jelajahi Event</button>
      {currentRole==='user'&&<button onClick={()=>{setUserTab('Tersimpan');setSelectedEvent(null);}} className={`py-3 whitespace-nowrap ${userTab==='Tersimpan'?'text-red-600 font-bold':'text-gray-500'}`}>Event Tersimpan</button>}
      {currentRole==='user'&&<button onClick={()=>setShowUserProfile(true)} className="py-3 whitespace-nowrap text-gray-500">Profil Saya</button>}
      {currentRole==='admin'&&<button onClick={()=>setAdminTab('moderation')} className="py-3 whitespace-nowrap text-red-600 font-bold">Panel Admin</button>}
     </div>
    </nav>

    {/* PANEL ADMIN HANYA MUNCUL SAAT ROLE ADMIN */}
    {currentRole==='admin'&&(
     <section className="max-w-7xl mx-auto px-4 py-6">
      <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-5">
       <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
         <h2 className="text-2xl font-black">Dashboard Admin</h2>
         <p className="text-sm text-gray-600 dark:text-gray-300">Moderasi event dan pantau akun pengguna.</p>
        </div>
        <div className="flex gap-2">
         <button onClick={()=>setAdminTab('moderation')} className={`px-4 py-2 rounded-xl ${adminTab==='moderation'?'bg-red-600 text-white':'bg-white dark:bg-gray-900 border'}`}>Moderasi Event</button>
         <button onClick={()=>setAdminTab('users')} className={`px-4 py-2 rounded-xl ${adminTab==='users'?'bg-red-600 text-white':'bg-white dark:bg-gray-900 border'}`}>Pengguna</button>
        </div>
       </div>

       {adminTab==='moderation'&&<div className="mt-5 space-y-3">
        {events.filter(e=>e.moderation_status==='Pending').length===0&&<p className="text-sm text-gray-500">Tidak ada event menunggu moderasi.</p>}
        {events.filter(e=>e.moderation_status==='Pending').map(e=><div key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
         <div><div className="font-bold">{e.title}</div><div className="text-xs text-gray-500">{e.organizer_name} · {e.city}, {e.province}</div></div>
         <div className="flex gap-2">
          <button onClick={()=>handleModeration(e.id,'Approved')} className="rounded-lg bg-green-600 text-white px-3 py-2 text-sm">Setujui</button>
          <button onClick={()=>handleModeration(e.id,'Rejected')} className="rounded-lg bg-red-600 text-white px-3 py-2 text-sm">Tolak</button>
         </div>
        </div>)}
       </div>}

       {adminTab==='users'&&<div className="mt-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
         <div className="rounded-xl bg-white dark:bg-gray-900 p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500">Total pengguna terdaftar</div>
          <div className="text-3xl font-black">{registeredUsers.length}</div>
         </div>
         <div className="rounded-xl bg-white dark:bg-gray-900 p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500">Event menunggu persetujuan</div>
          <div className="text-3xl font-black">{events.filter(e=>e.moderation_status==='Pending').length}</div>
         </div>
         <div className="rounded-xl bg-white dark:bg-gray-900 p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500">Event dipromosikan</div>
          <div className="text-3xl font-black">{events.filter(e=>e.is_sponsored).length}</div>
         </div>
        </div>
        {usersLoadError&&<p className="mb-3 rounded-xl bg-red-100 text-red-800 p-3 text-sm">Gagal mengambil data pengguna: {usersLoadError}. Periksa kebijakan RLS tabel users.</p>}
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
         <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 dark:bg-gray-800"><tr><th className="p-3">Pengguna</th><th className="p-3">Username</th><th className="p-3">Bergabung</th></tr></thead>
          <tbody>
           {registeredUsers.map(u=><tr key={u.id} className="border-t border-gray-200 dark:border-gray-700">
            <td className="p-3"><div className="flex items-center gap-2"><div className="w-9 h-9 rounded-full overflow-hidden">{avatarFor(u.avatar_url,u.display_name)}</div><span>{u.display_name||u.username}</span></div></td>
            <td className="p-3">@{u.username}</td>
            <td className="p-3">{u.created_at?new Date(u.created_at).toLocaleDateString('id-ID'):'-'}</td>
           </tr>)}
          </tbody>
         </table>
        </div>
       </div>}
      </div>
     </section>
    )}

    {/* HERO */}
    { !selectedEvent && <main className="max-w-7xl mx-auto px-4 py-8">
     <section className="rounded-3xl overflow-hidden bg-gradient-to-br from-red-700 to-red-500 text-white p-6 sm:p-10">
      <div className="max-w-2xl">
       <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-sm mb-4">🎌 Direktori Event Jejepangan Indonesia</div>
       <h1 className="text-3xl sm:text-5xl font-black leading-tight">Temukan Keseruan Event Favoritmu!</h1>
       <p className="mt-3 text-white/90">Jadwal event cosplay, idol, toys, dan komunitas dalam satu tempat.</p>
       <button onClick={()=>document.getElementById('event-list')?.scrollIntoView({behavior:'smooth'})} className="mt-6 rounded-xl bg-white text-red-700 px-5 py-3 font-bold">Jelajahi Event ↓</button>
      </div>
     </section>

     <section className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4"><div className="text-gray-500 text-sm">Event tersedia</div><div className="text-2xl font-black">{events.filter(e=>e.moderation_status==='Approved').length}</div></div>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4"><div className="text-gray-500 text-sm">Provinsi</div><div className="text-2xl font-black">{new Set(events.filter(e=>e.moderation_status==='Approved').map(e=>e.province)).size}</div></div>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4"><div className="text-gray-500 text-sm">Gratis</div><div className="text-2xl font-black">{events.filter(e=>e.moderation_status==='Approved'&&e.ticket_type==='Gratis').length}</div></div>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4"><div className="text-gray-500 text-sm">Event dipromosikan</div><div className="text-2xl font-black">{events.filter(e=>e.moderation_status==='Approved'&&e.is_sponsored).length}</div></div>
     </section>

     <section id="event-list" className="mt-9">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
       <div><h2 className="text-2xl font-black">{userTab==='Tersimpan'?'Event Tersimpan':'Jelajahi Event'}</h2><p className="text-sm text-gray-500 mt-1">Cari acara berdasarkan lokasi, tanggal, dan kategori.</p></div>
       <select value={sortMode} onChange={e=>setSortMode(e.target.value as any)} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"><option>Terbaru</option><option>Terpopuler</option></select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
       <select value={selectedProv} onChange={e=>{setSelectedProv(e.target.value);setSelectedCity('Semua');}} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3"><option>Semua</option>{ALL_PROVINCES.map(p=><option key={p}>{p}</option>)}</select>
       <select value={selectedCity} onChange={e=>setSelectedCity(e.target.value)} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3"><option>Semua</option>{cities.map(c=><option key={c}>{c}</option>)}</select>
       <select value={selectedCat} onChange={e=>setSelectedCat(e.target.value as any)} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3"><option value="Semua">Semua Kategori</option>{eventCategoryOptions.map(c=><option key={c} value={c}>{c}</option>)}</select>
       <select value={selectedTicket} onChange={e=>setSelectedTicket(e.target.value as any)} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3"><option value="Semua">Semua Tiket</option><option>Gratis</option><option>Berbayar</option></select>
      </div>

      {loading?<div className="py-16 text-center text-gray-500">Memuat event...</div>:publicEvents.length===0?<div className="py-16 text-center rounded-2xl border border-dashed border-gray-300 dark:border-gray-700"><div className="text-4xl mb-3">🎪</div><h3 className="font-bold text-lg">Belum ada event ditemukan</h3><p className="text-sm text-gray-500 mt-1">Coba ubah kata kunci atau filter.</p></div>:
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {publicEvents.map(e=><article key={e.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 hover:shadow-lg transition-shadow">
         <button onClick={()=>openEvent(e)} className="w-full text-left">
          <div className="relative aspect-[3/4] bg-gray-100 dark:bg-gray-800">
           {e.poster_url?<img src={e.poster_url} alt={e.title} className="w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center text-gray-400">Poster event</div>}
           {e.is_sponsored&&<span className="absolute top-3 left-3 rounded-full bg-yellow-400 text-black text-xs font-bold px-3 py-1">★ Promoted</span>}
           <span className={`absolute top-3 right-3 rounded-full text-xs font-bold px-3 py-1 ${getTimeStatus(e)==='Ongoing'?'bg-green-500 text-white':getTimeStatus(e)==='Completed'?'bg-gray-700 text-white':'bg-white text-gray-900'}`}>{getTimeStatus(e)==='Ongoing'?'Berlangsung':getTimeStatus(e)==='Completed'?'Selesai':'Akan datang'}</span>
          </div>
          <div className="p-4">
           <div className="flex flex-wrap gap-1 mb-2">{e.categories?.map(c=><span key={c} className="rounded-md bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-xs px-2 py-1">{c}</span>)}</div>
           <h3 className="font-bold text-lg leading-snug line-clamp-2">{e.title}</h3>
           <p className="text-sm text-gray-500 mt-2">📍 {e.city}, {e.province}</p>
           <p className="text-sm text-gray-500 mt-1">📅 {fmtDateRange(e)}</p>
           <div className="flex items-center justify-between mt-4"><span className="font-bold text-red-600">{e.ticket_type}</span><span className="text-xs text-gray-500">⭐ {(e.avg_rating||0).toFixed(1)} · {e.rating_count||0} ulasan</span></div>
          </div>
         </button>
         <div className="px-4 pb-4 flex items-center justify-between">
          <span className="text-xs text-gray-500">👁 {e.views||0} · ♥ {e.saves_count||0}</span>
          <button onClick={()=>toggleSave(e.id)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${savedIds.includes(e.id)?'bg-red-600 text-white':'border border-gray-200 dark:border-gray-700'}`}>{savedIds.includes(e.id)?'♥ Tersimpan':'♡ Simpan'}</button>
         </div>
        </article>)}
       </div>}
     </section>
    </main>}    {/* DETAIL EVENT */}
    {selectedEvent&&<main className="max-w-5xl mx-auto px-4 py-8">
     <button onClick={()=>setSelectedEvent(null)} className="mb-5 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2">← Kembali ke event</button>

     <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
      <div className="rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-900">
       {selectedEvent.poster_url&&<img src={selectedEvent.poster_url} alt={selectedEvent.title} className="w-full max-h-[700px] object-contain"/>}
      </div>
      <div>
       <div className="flex flex-wrap gap-2 mb-3">
        {selectedEvent.categories?.map(c=><span key={c} className="rounded-lg bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 px-3 py-1 text-xs font-bold">{c}</span>)}
        {selectedEvent.is_sponsored&&<span className="rounded-lg bg-yellow-300 text-black px-3 py-1 text-xs font-bold">★ Promoted</span>}
       </div>
       <h1 className="text-3xl font-black">{selectedEvent.title}</h1>
       <p className="mt-3 text-gray-500">Diselenggarakan oleh {selectedEvent.organizer_name||'Organizer'}</p>
       <div className="mt-5 space-y-3 text-sm">
        <p>📅 <strong>{fmtDateRange(selectedEvent)}</strong></p>
        <p>🕒 {selectedEvent.start_time} – {selectedEvent.end_time} WIB</p>
        <p>📍 {selectedEvent.venue_address||selectedEvent.city}, {selectedEvent.province}</p>
        <p>🎟️ <strong>{selectedEvent.ticket_type}</strong></p>
        <p>⭐ {(selectedEvent.avg_rating||0).toFixed(1)} dari 10 · {selectedEvent.rating_count||0} ulasan</p>
       </div>
       <div className="flex flex-wrap gap-3 mt-5">
        {selectedEvent.ticket_type==='Berbayar'&&selectedEvent.ticket_url&&<a href={selectedEvent.ticket_url} target="_blank" rel="noreferrer" className="rounded-xl bg-red-600 text-white px-5 py-3 font-bold">Beli Tiket</a>}
        {selectedEvent.registration_url&&<a href={selectedEvent.registration_url} target="_blank" rel="noreferrer" className="rounded-xl border border-gray-300 dark:border-gray-700 px-5 py-3 font-bold">Link Pendaftaran</a>}
        <button onClick={()=>toggleSave(selectedEvent.id)} className="rounded-xl border border-gray-300 dark:border-gray-700 px-5 py-3 font-bold">{savedIds.includes(selectedEvent.id)?'♥ Tersimpan':'♡ Simpan Event'}</button>
       </div>
       <div className="mt-7 border-t border-gray-200 dark:border-gray-800 pt-5">
        <h2 className="font-black text-xl">Tentang Event</h2>
        <p className="mt-3 whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">{selectedEvent.description}</p>
       </div>
      </div>
     </div>

     {/* RATING */}
     <section className="mt-10 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
      <h2 className="text-xl font-black">Rating dan Komentar</h2>
      <p className="text-sm text-gray-500 mt-1">Berikan penilaian berdasarkan pengalamanmu.</p>
      <div className="flex flex-wrap gap-2 mt-4">
       {Array.from({length:10},(_,i)=>i+1).map(n=><button key={n} onClick={()=>setMyRatings(prev=>({...prev,[selectedEvent.id]:n}))} className={`w-9 h-9 rounded-lg font-bold ${myRatings[selectedEvent.id]===n?'bg-red-600 text-white':'border border-gray-200 dark:border-gray-700'}`}>{n}</button>)}
      </div>
      <p className="text-xs text-gray-500 mt-2">Pilih nilai 1–10.</p>
      {currentRole==='user'&&<div className="mt-4">
       <textarea value={commentText} onChange={e=>setCommentText(e.target.value)} maxLength={1500} rows={4} placeholder="Tulis komentar atau pengalamanmu..." className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-3 outline-none focus:border-red-500"/>
       <div className="flex items-center justify-between gap-3 mt-3">
        <span className="text-xs text-gray-500">{commentText.length}/1500 karakter</span>
        <button onClick={handleAddComment} className="rounded-xl bg-red-600 text-white px-5 py-3 font-bold">Kirim Komentar</button>
       </div>
      </div>}
      {currentRole!=='user'&&<button onClick={()=>setShowLoginUser(true)} className="mt-4 rounded-xl bg-red-600 text-white px-5 py-3 font-bold">Login untuk memberi rating</button>}

      <div className="mt-6 space-y-4">
       {reviews.filter(r=>r.event_id===selectedEvent.id&&(r.comment||r.rating)).length===0&&<p className="py-6 text-center text-sm text-gray-500">Belum ada komentar untuk event ini.</p>}
       {reviews.filter(r=>r.event_id===selectedEvent.id&&(r.comment||r.rating)).map(r=><article key={r.id} className="flex gap-3 border-t border-gray-100 dark:border-gray-800 pt-4">
        <div className="w-11 h-11 shrink-0 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">{avatarFor(r.avatar_url,r.display_name||r.username)}</div>
        <div className="min-w-0 flex-1">
         <div className="flex flex-wrap items-center gap-2">
          <strong>{r.display_name||r.username||'User'}</strong>
          <span className="text-xs text-gray-500">@{r.username||'user'}</span>
          <span className="rounded-md bg-yellow-100 text-yellow-800 px-2 py-0.5 text-xs font-bold">⭐ {r.rating}/10</span>
         </div>
         <p className="text-xs text-gray-500 mt-1">{r.created_at?new Date(r.created_at).toLocaleString('id-ID'):'Tanggal tidak tersedia'}</p>
         {r.comment&&<p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{r.comment}</p>}
        </div>
       </article>)}
      </div>
     </section>

     {/* DOKUMENTASI EVENT */}
     <section className="mt-8 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
      <h2 className="text-xl font-black">Dokumentasi Pengunjung</h2>
      <p className="text-sm text-gray-500 mt-1">Bagikan foto keseruan event. Maksimal 3 MB per foto.</p>
      {currentRole==='user'&&<div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-900 p-4 space-y-3">
       <input type="file" accept="image/*" onChange={e=>setDocFile(e.target.files?.[0]||null)} className="block w-full text-sm"/>
       <input value={docCaption} onChange={e=>setDocCaption(e.target.value)} maxLength={300} placeholder="Caption foto (opsional)" className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-3"/>
       <button onClick={handleDocUpload} disabled={!docFile} className="rounded-xl bg-red-600 disabled:opacity-50 text-white px-5 py-3 font-bold">Unggah Dokumentasi</button>
      </div>}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
       {docs.filter(d=>d.event_id===selectedEvent.id).map(d=><article key={d.id} className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
        <img src={d.image_url} alt={d.caption||'Dokumentasi event'} className="w-full aspect-square object-cover"/>
        <div className="p-3"><p className="text-xs font-bold">{d.username||'Pengunjung'}</p><p className="text-sm mt-1 break-words">{d.caption}</p></div>
       </article>)}
      </div>
     </section>

     {/* Pemilik event tidak mendapatkan tombol dashboard di mode user */}
    </main>}    {/* MODAL LOGIN USER */}
    {showLoginUser&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
     <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl">
      <div className="flex items-center justify-between">
       <h2 className="text-2xl font-black">Masuk NGIPEN</h2>
       <button onClick={()=>setShowLoginUser(false)} className="text-2xl text-gray-500">×</button>
      </div>
      <p className="text-sm text-gray-500 mt-2">Masuk untuk menyimpan event dan memberi komentar.</p>
      <form onSubmit={e=>{e.preventDefault();void handleLoginUser();}} className="mt-5 space-y-4">
       <div><label className="block text-sm font-semibold mb-1">Username Instagram</label><input id="login-user-u" autoComplete="username" required className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-3" placeholder="username"/></div>
       <div><label className="block text-sm font-semibold mb-1">Password</label><input id="login-user-p" type="password" autoComplete="current-password" required className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-3" placeholder="Password"/></div>
       <button type="submit" className="w-full rounded-xl bg-red-600 text-white font-bold p-3">Masuk</button>
      </form>
      <p className="text-sm text-center mt-4 text-gray-500">Belum punya akun? <button onClick={()=>{setShowLoginUser(false);setShowRegUser(true);}} className="text-red-600 font-bold">Daftar</button></p>
     </div>
    </div>}

    {/* MODAL REGISTRASI USER */}
    {showRegUser&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
     <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl">
      <div className="flex items-center justify-between">
       <h2 className="text-2xl font-black">Daftar NGIPEN</h2>
       <button onClick={()=>setShowRegUser(false)} className="text-2xl text-gray-500">×</button>
      </div>
      <p className="text-sm text-gray-500 mt-2">Buat akun untuk menyimpan event favoritmu.</p>
      <form onSubmit={e=>{e.preventDefault();void handleRegUser();}} className="mt-5 space-y-4">
       <div><label className="block text-sm font-semibold mb-1">Username Instagram</label><input id="reg-user-u" autoComplete="username" required minLength={3} pattern="[a-zA-Z0-9_]+" className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-3" placeholder="username"/></div>
       <div><label className="block text-sm font-semibold mb-1">Nama tampilan</label><input id="reg-user-d" autoComplete="name" className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-3" placeholder="Nama kamu"/></div>
       <div><label className="block text-sm font-semibold mb-1">Password</label><input id="reg-user-p" type="password" autoComplete="new-password" required minLength={8} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-3" placeholder="Minimal 8 karakter, huruf dan angka"/></div>
       <p className="text-xs text-gray-500">Gunakan username unik. Jangan gunakan password yang dipakai pada akun penting lainnya.</p>
       <button type="submit" className="w-full rounded-xl bg-red-600 text-white font-bold p-3">Buat Akun</button>
      </form>
     </div>
    </div>}

    {/* MODAL PROFIL USER */}
    {showUserProfile&&currentRole==='user'&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
     <div className="w-full max-w-lg my-6 rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl">
      <div className="flex items-center justify-between">
       <h2 className="text-2xl font-black">Profil Saya</h2>
       <button onClick={()=>{setShowUserProfile(false);setUserAvatarFile(null);}} className="text-2xl text-gray-500">×</button>
      </div>
      <form onSubmit={e=>{e.preventDefault();void handleUpdateUserProfile();}} className="mt-5 space-y-4">
       <div className="flex flex-col items-center">
        <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-red-100 dark:border-red-950 bg-gray-100 dark:bg-gray-800">
         {avatarFor(userAvatarFile&&avatarToCrop?avatarToCrop:currentProfile?.avatar_url,currentProfile?.display_name||currentUser)}
        </div>
        <label className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 font-semibold cursor-pointer">
         Pilih Foto Profil
         <input type="file" accept="image/*" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file)handleAvatarFile(file);e.currentTarget.value='';}}/>
        </label>
        <p className="text-xs text-gray-500 mt-2">Foto akan dipotong menjadi 1:1, maksimal 3 MB setelah diproses.</p>
       </div>
       <div><label className="block text-sm font-semibold mb-1">Username</label><input value={currentProfile?.username||currentUser} readOnly className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-3 text-gray-500"/></div>
       <div><label className="block text-sm font-semibold mb-1">Nama tampilan</label><input id="edit-user-display" defaultValue={currentProfile?.display_name||currentUser} required maxLength={60} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-3"/></div>
       <div><label className="block text-sm font-semibold mb-1">Bio</label><textarea id="edit-user-bio" defaultValue={currentProfile?.bio||''} rows={4} maxLength={300} placeholder="Ceritakan sedikit tentang dirimu..." className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-3"/></div>
       <button type="submit" className="w-full rounded-xl bg-red-600 text-white font-bold p-3">Simpan Profil</button>
      </form>
      <div className="mt-6 border-t border-gray-200 dark:border-gray-800 pt-5">
       <h3 className="font-bold text-lg">Ubah Password</h3>
       <form onSubmit={e=>{e.preventDefault();void handleChangeUserPassword();}} className="mt-3 space-y-3">
        <input id="edit-user-oldpass" type="password" required autoComplete="current-password" placeholder="Password lama" className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-3"/>
        <input id="edit-user-newpass" type="password" required minLength={8} autoComplete="new-password" placeholder="Password baru (min. 8 karakter)" className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-3"/>
        <button type="submit" className="w-full rounded-xl border border-gray-300 dark:border-gray-700 p-3 font-bold">Ubah Password</button>
       </form>
      </div>
     </div>
    </div>}

    {/* MODAL CROPPING AVATAR */}
    {showAvatarCrop&&<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
     <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-5">
      <div className="flex items-center justify-between">
       <h2 className="text-xl font-black">Atur Foto Profil</h2>
       <button onClick={()=>setShowAvatarCrop(false)} className="text-2xl text-gray-500">×</button>
      </div>
      <p className="text-sm text-gray-500 mt-2">Atur pembesaran dan posisi foto sebelum menyimpan.</p>
      <div className="mx-auto mt-5 w-64 h-64 overflow-hidden rounded-full border-4 border-red-500 bg-gray-100 dark:bg-gray-800">
       <img ref={avatarImgRef} src={avatarToCrop} alt="Pratinjau crop avatar" onLoad={()=>setAvatarPos({x:0,y:0})} className="w-full h-full object-cover" style={{transform:`scale(${avatarZoom}) translate(${avatarPos.x/4}px,${avatarPos.y/4}px)`}}/>
      </div>
      <div className="mt-5">
       <label className="block text-sm font-semibold mb-2">Zoom: {avatarZoom.toFixed(1)}×</label>
       <input type="range" min="1" max="3" step="0.1" value={avatarZoom} onChange={e=>setAvatarZoom(Number(e.target.value))} className="w-full accent-red-600"/>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4">
       <div><label className="block text-sm mb-1">Geser horizontal</label><input type="range" min="-100" max="100" value={avatarPos.x} onChange={e=>setAvatarPos(p=>({...p,x:Number(e.target.value)}))} className="w-full accent-red-600"/></div>
       <div><label className="block text-sm mb-1">Geser vertikal</label><input type="range" min="-100" max="100" value={avatarPos.y} onChange={e=>setAvatarPos(p=>({...p,y:Number(e.target.value)}))} className="w-full accent-red-600"/></div>
      </div>
      <div className="flex gap-3 mt-5">
       <button onClick={()=>setShowAvatarCrop(false)} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 p-3 font-bold">Batal</button>
       <button onClick={applyAvatarCrop} className="flex-1 rounded-xl bg-red-600 text-white p-3 font-bold">Gunakan Foto</button>
      </div>
     </div>
    </div>}{showAvatarCrop&&<div>
  {/* ...isi modal crop avatar dari Part 6... */}
</div>}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white shadow-xl">
          {toast}
        </div>
      )}

      <footer className="border-t border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
        <p className="font-semibold text-red-600">NGIPEN</p>
        <p className="mt-1">Satu hobby satu keseruan.</p>
        <p className="mt-2">
          © {new Date().getFullYear()} NGIPEN. Semua hak dilindungi.
        </p>
      </footer>
    </div>
  </div>
);
}
