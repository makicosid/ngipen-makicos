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
interface Review { id: string; event_id: string; user_id: string; rating: number; comment?: string; created_at: string; }
interface RegUser { id: string; username: string; password_hash: string; display_name: string; bio?: string; avatar_url?: string; created_at: string; }

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

    const { data: usersData } = await supabase.from('users').select('*').order('created_at',{ascending:false});
    if(usersData) setRegisteredUsers(usersData as any);

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
    const { data: allReviews } = await supabase.from('event_reviews').select('*');
    if(allReviews) setReviews(allReviews as any);

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

 // Helpers - FIX RLS
 const uploadToBucket = async (file:File, bucket:string): Promise<string>=>{
  const fileName = `${currentUserId||'anon'}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g,'_')}`;
  try{
   const { error } = await supabase.storage.from(bucket).upload(fileName, file, { upsert:true, cacheControl:'3600' });
   if(error) throw error;
   const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
   return data.publicUrl;
  }catch(err:any){
   // fallback ke posters jika avatars RLS error
   if(bucket==='avatars'){
    const { error: err2 } = await supabase.storage.from('posters').upload(fileName, file, { upsert:true });
    if(err2) throw err2;
    const { data } = supabase.storage.from('posters').getPublicUrl(fileName);
    return data.publicUrl;
   }
   throw err;
  }
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
  if(!data || (data as any).password_hash!==p){ setToast("Username/password salah"); setTimeout(()=>setToast(""),2000); return; }
  localStorage.setItem('ngipen_role','user'); localStorage.setItem('ngipen_user',data.display_name); localStorage.setItem('ngipen_user_id',data.id);
  setCurrentRole('user'); setCurrentUser(data.display_name); setCurrentUserId(data.id);
  const { data: saves } = await supabase.from('event_saves').select('*').eq('user_id',data.id); if(saves) setSavedIds(saves.map((s:any)=>s.event_id));
  setShowLoginUser(false); setToast(`Halo ${data.display_name}`); setTimeout(()=>setToast(""),2000);
 };
 const handleRegUser = async()=>{
  const username = (document.getElementById('reg-user-u') as HTMLInputElement)?.value?.trim().toLowerCase();
  const display = (document.getElementById('reg-user-d') as HTMLInputElement)?.value?.trim();
  const pass = (document.getElementById('reg-user-p') as HTMLInputElement)?.value;
  if(!username||username.length<3){ setToast("Username min 3"); setTimeout(()=>setToast(""),2000); return; }
  if(!/^[a-z0-9_]+$/.test(username)){ setToast("Username huruf kecil/angka/_"); setTimeout(()=>setToast(""),2000); return; }
  if(!pass||pass.length<8||!/[a-zA-Z]/.test(pass)||!/[0-9]/.test(pass)){ setToast("Password min 8 huruf+angka"); setTimeout(()=>setToast(""),2000); return; }
  const { data: exist } = await supabase.from('users').select('id').eq('username',username).maybeSingle(); if(exist){ setToast("Username dipakai"); setTimeout(()=>setToast(""),2000); return; }
  const { data, error } = await supabase.from('users').insert({ username, normalized_username:username, password_hash:pass, display_name:display||username, bio:'', avatar_url:'' }).select().single();
  if(error){ setToast("Gagal daftar: "+error.message); setTimeout(()=>setToast(""),2000); return; }
  setRegisteredUsers(prev=>[data as any,...prev]); setShowRegUser(false); setToast("User terdaftar, silakan login"); setTimeout(()=>setToast(""),2000);
 };
 const handleLoginAdmin = async()=>{
  const u = (document.getElementById('admin-user') as HTMLInputElement)?.value?.trim();
  const p = (document.getElementById('admin-pin') as HTMLInputElement)?.value?.trim();
  if(!u || !p){ setToast("Isi username & pin"); setTimeout(()=>setToast(""),2000); return; }
  const { data } = await supabase.from('admin_settings').select('username, pin_hash').eq('username', u).maybeSingle();
  if(data && (data as any).pin_hash === p){
    localStorage.setItem('ngipen_role','admin'); setCurrentRole('admin'); setShowAdmin(false); setToast("Admin login"); setTimeout(()=>setToast(""),2000); return;
  }
  if(u==='makicos' && (p==='1111' || p==='2567')){
    localStorage.setItem('ngipen_role','admin'); setCurrentRole('admin'); setShowAdmin(false); setToast("Admin login (default)"); setTimeout(()=>setToast(""),2000); return;
  }
  setToast("Admin salah"); setTimeout(()=>setToast(""),2000);
 };
 const logout = ()=>{
  localStorage.removeItem('ngipen_role'); localStorage.removeItem('ngipen_user'); localStorage.removeItem('ngipen_user_id');
  setCurrentRole('guest'); setCurrentUser(''); setCurrentUserId(''); setSavedIds([]); setMyRatings({}); setMobileOpen(false);
  setToast("Logout"); setTimeout(()=>setToast(""),2000);
 };

 // Events CRUD - Pending for user view
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
    organizer_id: currentUserId,
    title, slug: slugify(title), description:desc, poster_url:posterUrl,
    categories:newCategories, province:prov, city, venue_address:venue,
    start_date:start, end_date:end, start_time:startTime, end_time:endTime,
    ticket_type:newTicketType, ticket_url:ticketUrl||null, registration_url:lombaUrl||null,
    moderation_status:'Pending', is_sponsored:false, sponsored_priority:0,
    views:0, saves_count:0, avg_rating:0, rating_count:0, organizer_name:currentUser
   };
   let data:any = null;
   if(editingEvent){
    const { data: upd, error } = await supabase.from('events').update({...payload, moderation_status:'Pending'}).eq('id',editingEvent.id).select().single();
    if(error) throw error; data=upd;
    setEvents(prev=>prev.map(e=>e.id===editingEvent.id?{...e,...data, organizer_name:currentUser} as Event:e));
    setToast("Event diupdate, menunggu approval"); 
   }else{
    const { data: ins, error } = await supabase.from('events').insert(payload).select().single();
    if(error) throw error; data=ins;
    const newEv:Event = { id:data.id, organizer_id:data.organizer_id, title:data.title, slug:data.slug, description:data.description, poster_url:data.poster_url, categories:data.categories, province:data.province, city:data.city, venue_address:data.venue_address, start_date:data.start_date, end_date:data.end_date, start_time:startTime, end_time:endTime, ticket_type:data.ticket_type, ticket_url:data.ticket_url, registration_url:data.registration_url, moderation_status:'Pending', is_sponsored:false, sponsored_priority:0, views:0, saves_count:0, avg_rating:0, rating_count:0, organizer_name:currentUser, created_at:data.created_at };
    setEvents(prev=>[newEv,...prev]);
    setToast("Event dibuat, menunggu approval admin");
   }
   setEventFormOpen(false); setEditingEvent(null); setPosterFile(null); setPosterPreview("");
   setTimeout(()=>setToast(""),2500);
  }catch(e:any){ setToast("Gagal buat event: "+e.message); setTimeout(()=>setToast(""),3000); }
 };

 const handleModeration = async(id:string, status:ModStatus, sponsor?:boolean, priority?:number)=>{
  const update:any = { moderation_status:status };
  if(sponsor!==undefined) update.is_sponsored=sponsor;
  if(priority!==undefined) update.sponsored_priority=priority;
  if(sponsor){ update.sponsored_start=new Date().toISOString(); const end=new Date(); end.setDate(end.getDate()+30); update.sponsored_end=end.toISOString(); }
  const { error } = await supabase.from('events').update(update).eq('id',id);
  if(error){ setToast("Gagal: "+error.message); setTimeout(()=>setToast(""),2000); return; }
  setEvents(prev=>prev.map(e=>e.id===id?{...e,...update}:e));
  setToast(`Event ${status}`); setTimeout(()=>setToast(""),2000);
 };

 // User interactions
 const toggleSave = async(eventId:string)=>{
  if(currentRole!=='user'){ setShowLoginUser(true); return; }
  const isSaved = savedIds.includes(eventId);
  if(isSaved){
   await supabase.from('event_saves').delete().eq('user_id',currentUserId).eq('event_id',eventId);
   setSavedIds(prev=>prev.filter(id=>id!==eventId));
   setEvents(prev=>prev.map(e=>e.id===eventId?{...e, saves_count:Math.max(0,e.saves_count-1)}:e));
  }else{
   await supabase.from('event_saves').insert({ user_id:currentUserId, event_id:eventId });
   setSavedIds(prev=>[...prev,eventId]);
   setEvents(prev=>prev.map(e=>e.id===eventId?{...e, saves_count:e.saves_count+1}:e));
  }
 };
 const handleRate = async(eventId:string, rating:number)=>{
  if(currentRole!=='user'){ setShowLoginUser(true); return; }
  const { data: exist } = await supabase.from('event_reviews').select('*').eq('user_id',currentUserId).eq('event_id',eventId).maybeSingle();
  if(exist) await supabase.from('event_reviews').update({ rating }).eq('id',exist.id);
  else await supabase.from('event_reviews').insert({ user_id:currentUserId, event_id:eventId, rating });
  setMyRatings(prev=>({...prev,[eventId]:rating}));
  const { data: all } = await supabase.from('event_reviews').select('*').eq('event_id',eventId);
  if(all){
   const avg = (all as any).reduce((s:any,r:any)=>s+r.rating,0)/all.length;
   await supabase.from('events').update({ avg_rating:avg, rating_count:all.length }).eq('id',eventId);
   setEvents(prev=>prev.map(e=>e.id===eventId?{...e, avg_rating:avg, rating_count:all.length}:e));
   if(selectedEvent && selectedEvent.id===eventId) setSelectedEvent(prev=>prev?{...prev, avg_rating:avg, rating_count:all.length}:null);
   setReviews(prev=>{ const other = prev.filter(r=>r.event_id!==eventId); return [...(all as any), ...other]; });
  }
  setToast(`Rating ${rating}/10 disimpan`); setTimeout(()=>setToast(""),2000);
 };
 const handleAddComment = async()=>{
  if(!selectedEvent) return;
  if(currentRole!=='user'){ setShowLoginUser(true); return; }
  if(!commentText.trim() && !myRatings[selectedEvent.id]){ setToast("Rating atau komentar wajib"); setTimeout(()=>setToast(""),2000); return; }
  const { data: exist } = await supabase.from('event_reviews').select('*').eq('user_id',currentUserId).eq('event_id',selectedEvent.id).maybeSingle();
  if(exist){
   await supabase.from('event_reviews').update({ rating: myRatings[selectedEvent.id]||(exist as any).rating, comment: commentText.trim()||(exist as any).comment }).eq('id',(exist as any).id);
  } else {
   await supabase.from('event_reviews').insert({ user_id:currentUserId, event_id:selectedEvent.id, rating: myRatings[selectedEvent.id]||5, comment: commentText.trim() });
  }
  setCommentText(""); setToast("Komentar & rating disimpan"); setTimeout(()=>setToast(""),2000);
  const { data: all } = await supabase.from('event_reviews').select('*').eq('event_id',selectedEvent.id).order('created_at',{ascending:false});
  if(all){
   setReviews(prev=>{ const other = prev.filter(r=>r.event_id!==selectedEvent.id); return [...(all as any), ...other]; });
   const avg = (all as any).reduce((s:any,r:any)=>s+r.rating,0)/all.length;
   await supabase.from('events').update({ avg_rating:avg, rating_count:all.length }).eq('id',selectedEvent.id);
   setEvents(prev=>prev.map(e=>e.id===selectedEvent.id?{...e, avg_rating:avg, rating_count:all.length}:e));
   setSelectedEvent(prev=>prev?{...prev, avg_rating:avg, rating_count:all.length}:null);
  }
 };
 const handleUploadDoc = async()=>{
  if(!selectedEvent) return;
  if(currentRole!=='user'){ setShowLoginUser(true); return; }
  if(getTimeStatus(selectedEvent)!=='Completed'){ setToast("Dokumentasi hanya untuk event Completed"); setTimeout(()=>setToast(""),2000); return; }
  if(!docFile){ setToast("Pilih foto"); setTimeout(()=>setToast(""),2000); return; }
  if(docFile.size>10*1024*1024){ setToast("Max 10MB"); setTimeout(()=>setToast(""),2000); return; }
  try{
   const url = await uploadToBucket(docFile,'documentations');
   const { data, error } = await supabase.from('event_documentations').insert({ event_id:selectedEvent.id, user_id:currentUserId, username:currentUser, image_url:url, caption:docCaption }).select().single();
   if(error){
    const { data: d2, error: e2 } = await supabase.from('documentations').insert({ event_id:selectedEvent.id, user_id:currentUserId, username:currentUser, image_url:url, caption:docCaption }).select().single();
    if(e2) throw e2;
    setDocs(prev=>[{ id:d2.id, event_id:d2.event_id||d2.eventId, user_id:currentUserId, username:currentUser, image_url:url, caption:docCaption, created_at:d2.created_at } as any,...prev]);
   } else {
    setDocs(prev=>[data as any,...prev]);
   }
   setDocFile(null); setDocCaption(""); setToast("Dokumentasi diupload"); setTimeout(()=>setToast(""),2000);
  }catch(e:any){ setToast("Gagal upload: "+e.message); setTimeout(()=>setToast(""),2000); }
 };

 // Profile updates - FIX BIO + AVATAR CROP
 const handleUpdateUserProfile = async()=>{
  const displayName = (document.getElementById('edit-user-display') as HTMLInputElement)?.value?.trim();
  const bio = (document.getElementById('edit-user-bio') as HTMLTextAreaElement)?.value?.trim()||"";
  let avatarUrl = registeredUsers.find(u=>u.id===currentUserId)?.avatar_url||"";
  if(userAvatarFile){ 
   try{ 
    avatarUrl = await uploadToBucket(userAvatarFile,'avatars'); 
   }catch(e:any){ 
    setToast("Gagal avatar: "+e.message); setTimeout(()=>setToast(""),3000); return; 
   } 
  }
  const { error } = await supabase.from('users').update({ display_name:displayName, bio, avatar_url:avatarUrl }).eq('id',currentUserId);
  if(error){ setToast("Gagal: "+error.message); setTimeout(()=>setToast(""),2000); return; }
  // FIX: update state langsung biar refresh tetap ada
  setRegisteredUsers(prev=>prev.map(u=>u.id===currentUserId?{...u, display_name:displayName||u.display_name, bio, avatar_url:avatarUrl}:u));
  setCurrentUser(displayName||currentUser); 
  localStorage.setItem('ngipen_user',displayName||currentUser);
  setUserAvatarFile(null);
  setShowUserProfile(false); setToast("Profil diperbarui"); setTimeout(()=>setToast(""),2000);
 };
 const handleChangeUserPassword = async()=>{
  const oldPass = (document.getElementById('edit-user-oldpass') as HTMLInputElement)?.value;
  const newPass = (document.getElementById('edit-user-newpass') as HTMLInputElement)?.value;
  const { data } = await supabase.from('users').select('password_hash').eq('id',currentUserId).maybeSingle();
  if(!data || data.password_hash!==oldPass){ setToast("Password lama salah"); setTimeout(()=>setToast(""),2000); return; }
  if(!newPass||newPass.length<8||!/[a-zA-Z]/.test(newPass)||!/[0-9]/.test(newPass)){ setToast("Password baru min 8 huruf+angka"); setTimeout(()=>setToast(""),2000); return; }
  await supabase.from('users').update({ password_hash:newPass }).eq('id',currentUserId);
  setToast("Password diganti"); setTimeout(()=>setToast(""),2000);
 };

 // Avatar crop handler
 const handleAvatarCropSave = async()=>{
  if(!avatarImgRef.current) return;
  const canvas = document.createElement('canvas');
  const size = 512;
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d'); if(!ctx) return;
  const img = avatarImgRef.current;
  // crop 1:1 center with zoom & pos
  const scale = avatarZoom;
  const imgW = img.naturalWidth * scale;
  const imgH = img.naturalHeight * scale;
  const sx = (img.naturalWidth/2 - size/(2*scale) + avatarPos.x);
  const sy = (img.naturalHeight/2 - size/(2*scale) + avatarPos.y);
  ctx.drawImage(img, sx, sy, size/scale, size/scale, 0, 0, size, size);
  canvas.toBlob(async (blob)=>{
   if(!blob) return;
   if(blob.size>3*1024*1024){ setToast("Hasil crop >3MB, kecilkan zoom"); return; }
   const file = new File([blob], `avatar-${Date.now()}.jpg`, { type:'image/jpeg' });
   setUserAvatarFile(file);
   setShowAvatarCrop(false);
   setToast("Avatar siap, klik Simpan"); setTimeout(()=>setToast(""),2000);
  }, 'image/jpeg', 0.9);
 };

 // Derived - FIX: user liat semua Approved, bukan cuma own (hapus dashboard EO)
 const approvedEvents = useMemo(()=>events.filter(e=>e.moderation_status==='Approved'),[events]);
 const sponsoredEvents = useMemo(()=>approvedEvents.filter(e=>e.is_sponsored).sort((a,b)=>b.sponsored_priority-a.sponsored_priority).slice(0,10),[approvedEvents]);
 const filteredEvents = useMemo(()=>{
  let list = currentRole==='admin' ? events : approvedEvents; // FIX: user = approvedEvents, bukan filter organizer_id
  if(currentRole==='user' && userTab==='Tersimpan') list = list.filter(e=>savedIds.includes(e.id));
  if(search) list = list.filter(e=>e.title.toLowerCase().includes(search.toLowerCase()));
  if(selectedProv!=='Semua') list = list.filter(e=>e.province===selectedProv);
  if(selectedCity!=='Semua') list = list.filter(e=>e.city===selectedCity);
  if(selectedCat!=='Semua') list = list.filter(e=>e.categories.includes(selectedCat as any));
  if(selectedTicket!=='Semua') list = list.filter(e=>e.ticket_type===selectedTicket);
  if(sortMode==='Terbaru') list = [...list].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
  if(sortMode==='Terpopuler') list = [...list].sort((a,b)=>b.views-a.views);
  return list;
 },[events,approvedEvents,search,selectedProv,selectedCity,selectedCat,selectedTicket,sortMode,currentRole,savedIds,userTab]);
 const cityOptions = useMemo(()=>{ if(selectedProv==='Semua') return ["Semua"]; const cities = Array.from(new Set(events.filter(e=>e.province===selectedProv).map(e=>e.city))).filter(Boolean); return ["Semua",...cities]; },[selectedProv,events]);

 const openDetail = async(ev:Event)=>{
  setSelectedEvent(ev);
  await supabase.from('events').update({ views:ev.views+1 }).eq('id',ev.id);
  setEvents(prev=>prev.map(e=>e.id===ev.id?{...e,views:e.views+1}:e));
  const { data: revs } = await supabase.from('event_reviews').select('*').eq('event_id',ev.id).order('created_at',{ascending:false});
  if(revs) setReviews(prev=>{ const other = prev.filter(r=>r.event_id!==ev.id); return [...(revs as any), ...other]; });
  const { data: d1 } = await supabase.from('event_documentations').select('*').eq('event_id',ev.id).order('created_at',{ascending:false});
  if(d1 && d1.length>0) setDocs(prev=>{ const other = prev.filter(d=>d.event_id!==ev.id); return [...(d1 as any), ...other]; });
 };

 const getUserById = (uid:string)=> registeredUsers.find(u=>u.id===uid);

 return (
  <div className={`${dark?"dark bg-[#0F0F0F] text-white":"bg-[#FAFAF8] text-black"} min-h-screen transition`}>
   <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap'); *{font-family:'Plus Jakarta Sans',sans-serif}`}</style>

   {/* HEADER */}
   <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-[#1A1A1A]/80 border-b">
    <div className="max-w- mx-auto px-4 h- flex items-center justify-between">
     <div className="flex items-center gap-3 cursor-pointer" onClick={()=>{ const now=Date.now(); const last=Number(localStorage.getItem('logo_last')||0); if(now-last<4000){ const c=logoClicks+1; setLogoClicks(c); if(c>=5){ setShowAdmin(true); setLogoClicks(0); } } else setLogoClicks(1); localStorage.setItem('logo_last',String(now)); }}>
      <img src="/logo.png" alt="NGIPEN" className="w-9 h-9 object-contain rounded-xl bg-white" />
      <div><div className="font-black leading-none">NGIPEN</div><div className="text- tracking-widest opacity-60">SATU HOBBY SATU KESERUAN</div></div>
     </div>
     <div className="hidden md:flex items-center gap-2">
      {currentRole==='guest' && <><button onClick={()=>setShowLoginUser(true)} className="h-10 px-4 rounded-full border font-bold text-sm">Masuk</button><button onClick={()=>setShowRegUser(true)} className="h-10 px-4 rounded-full bg-black text-white font-bold text-sm">Daftar</button></>}
      {currentRole!=='guest' && <><div className="h-10 px-4 rounded-full bg-[#F3F3F3] dark:bg-[#2A2A2A] border flex items-center gap-2 text-sm font-bold"><div className="w-2 h-2 rounded-full bg-green-500"></div>{currentRole.toUpperCase()} : {currentUser}</div>
       {currentRole==='user' && <button onClick={()=>setShowUserProfile(true)} className="h-10 px-4 rounded-full border font-bold text-sm">Profil</button>}
       {currentRole==='user' && <><button onClick={()=>{ setEditingEvent(null); setEventFormOpen(true); setNewCategories(["Cosplay"]); }} className="h-10 px-5 rounded-full bg-[#E53935] text-white font-bold text-sm">Upload</button></>}
       <button onClick={logout} className="h-10 w-10 rounded-full border font-bold">⎋</button></>}
      <button onClick={()=>{ const nd=!dark; setDark(nd); localStorage.setItem('ngipen_theme',nd?'dark':'light'); if(nd) document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark'); }} className="h-10 w-10 rounded-full border">{dark?'☀️':'🌙'}</button>
     </div>
     <button onClick={()=>setMobileOpen(!mobileOpen)} className="md:hidden w-11 h-11 rounded-full border flex items-center justify-center">☰</button>
    </div>
    {mobileOpen && <div className="md:hidden border-t p-4 grid gap-2 bg-white dark:bg-[#1A1A1A]">
     {currentRole==='guest' && <><button onClick={()=>{ setMobileOpen(false); setShowLoginUser(true); }} className="h-12 rounded-full border font-bold">Masuk User</button><button onClick={()=>{ setMobileOpen(false); setShowRegUser(true); }} className="h-12 rounded-full bg-black text-white font-bold">Daftar User</button></>}
     {currentRole==='user' && <><div className="p-3 rounded-xl bg-[#F3F3F3] dark:bg-[#2A2A2A] font-bold text-sm">USER: {currentUser}</div><button onClick={()=>{ setMobileOpen(false); setShowUserProfile(true); }} className="h-12 rounded-full border font-bold">Edit Profil</button><button onClick={()=>{ setMobileOpen(false); setEditingEvent(null); setEventFormOpen(true); }} className="h-12 rounded-full bg-[#E53935] text-white font-bold">Upload Event</button><button onClick={logout} className="h-12 rounded-full border font-bold">Keluar</button></>}
     {currentRole==='admin' && <><div className="p-3 rounded-xl bg-black text-white font-bold text-sm">ADMIN: makicos</div><button onClick={logout} className="h-12 rounded-full border font-bold">Keluar</button></>}
    </div>}
   </header>

   {/* SPONSOR CAROUSEL - only Approved sponsored */}
   {sponsoredEvents.length>0 && currentRole!=='admin' && (
    <div className="max-w- mx-auto px-4 mt-6">
     <div className="rounded- bg-white dark:bg-[#1A1A1A] border p-4">
      <div className="flex items-center justify-between mb-3"><div className="font-black flex items-center gap-2">★ Sponsor <span className="text-xs font-bold opacity-60">{sponsoredEvents.length}/10</span></div></div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
       {sponsoredEvents.map(ev=>(<div key={ev.id} onClick={()=>openDetail(ev)} className="cursor-pointer rounded- overflow-hidden border group"><div className="aspect-[3/4] relative"><img src={ev.poster_url} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" /><div className="absolute top-2 left-2 bg-[#FFD600] text-black text- font-black px-2 py-1 rounded-full">★ SPONSOR</div></div><div className="p-2"><div className="font-bold text-xs truncate">{ev.title}</div><div className="text- opacity-60">{ev.city}</div></div></div>))}
      </div>
     </div>
    </div>
   )}

   {/* FILTER */}
   <div className="max-w- mx-auto px-4 mt-6">
    <div className="rounded- bg-white dark:bg-[#1A1A1A] border p-4 grid gap-3">
     <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari event..." className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />
      <select value={selectedProv} onChange={e=>{ setSelectedProv(e.target.value); setSelectedCity("Semua"); }} className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm"><option>Semua</option>{ALL_PROVINCES.map(p=><option key={p}>{p}</option>)}</select>
      <select value={selectedCity} onChange={e=>setSelectedCity(e.target.value)} className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm">{cityOptions.map(c=><option key={c}>{c}</option>)}</select>
      <select value={selectedCat} onChange={e=>setSelectedCat(e.target.value as any)} className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm"><option>Semua</option>{eventCategoryOptions.map(c=><option key={c}>{c}</option>)}<option>Gratis</option><option>Berbayar</option></select>
      <select value={selectedTicket} onChange={e=>setSelectedTicket(e.target.value as any)} className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm"><option>Semua</option><option>Gratis</option><option>Berbayar</option></select>
     </div>
     <div className="flex items-center gap-2 flex-wrap">
      <button onClick={()=>setSortMode("Terbaru")} className={`h-9 px-4 rounded-full font-bold text-sm ${sortMode==='Terbaru'?'bg-black text-white':'bg-[#F3F3F3] dark:bg-[#2A2A2A] border'}`}>Terbaru</button>
      <button onClick={()=>setSortMode("Terpopuler")} className={`h-9 px-4 rounded-full font-bold text-sm ${sortMode==='Terpopuler'?'bg-black text-white':'bg-[#F3F3F3] dark:bg-[#2A2A2A] border'}`}>Terpopuler</button>
      <button onClick={()=>{ setSearch(""); setSelectedProv("Semua"); setSelectedCity("Semua"); setSelectedCat("Semua"); setSelectedTicket("Semua"); }} className="h-9 px-4 rounded-full border font-bold text-sm">Reset</button>
      <div className="ml-auto text-xs opacity-60">Event ({filteredEvents.length}) • User {registeredUsers.length}</div>
     </div>
     {currentRole==='user' && (
      <div className="flex gap-2">
       <button onClick={()=>setUserTab("Semua")} className={`h-9 px-4 rounded-full font-bold text-sm ${userTab==='Semua'?'bg-black text-white':'border'}`}>Semua</button>
       <button onClick={()=>setUserTab("Tersimpan")} className={`h-9 px-4 rounded-full font-bold text-sm ${userTab==='Tersimpan'?'bg-black text-white':'border'}`}>Tersimpan ({savedIds.length})</button>
      </div>
     )}
    </div>
   </div>

   {/* GRID - NO EO DASHBOARD */}
   <div className="max-w- mx-auto px-4 mt-6">
    {loading ? <div className="text-center py-20 opacity-60">Memuat event...</div> :
     filteredEvents.length===0 ? (
      <div className="text-center py-20">
       <div className="w-16 h-16 mx-auto rounded-full bg-[#F3F3F3] dark:bg-[#2A2A2A] flex items-center justify-center text-2xl">📭</div>
       <div className="font-bold mt-4">{currentRole==='user'?"Belum ada event":"Belum ada event"}</div>
       <div className="text-sm opacity-60 mt-1">{currentRole==='user'?"Upload event pertama kamu": userTab==='Tersimpan'?"Belum ada event tersimpan":"Jadilah yang pertama upload event"}</div>
      </div>
     ) : (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
       {filteredEvents.map(ev=>{
        const timeStatus = getTimeStatus(ev);
        const isOwn = currentRole==='user' && ev.organizer_id===currentUserId;
        return (
         <div key={ev.id} className="rounded- overflow-hidden bg-white dark:bg-[#1A1A1A] border hover:shadow-lg transition group">
          <div onClick={()=>openDetail(ev)} className="aspect-[3/4] relative cursor-pointer overflow-hidden bg-[#F3F3F3]">
           <img src={ev.poster_url} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
           {ev.is_sponsored && <div className="absolute top-2 left-2 bg-[#FFD600] text-black text- font-black px-2 py-1 rounded-full">★ SPONSOR</div>}
           <div className="absolute top-2 right-2 bg-black/70 text-white text- font-bold px-2 py-1 rounded-full">{timeStatus}</div>
           {currentRole==='admin' && <div className="absolute bottom-2 left-2 bg-white text-black text- font-bold px-2 py-1 rounded-full">{ev.moderation_status}</div>}
           {isOwn && <div className="absolute bottom-2 left-2 bg-[#E53935] text-white text- font-bold px-2 py-1 rounded-full">{ev.moderation_status}</div>}
          </div>
          <div className="p-3">
           <div onClick={()=>openDetail(ev)} className="cursor-pointer"><div className="font-bold text-sm leading-tight truncate">{ev.title}</div><div className="text- opacity-60 mt-1">{ev.city} • {ev.categories[0]}</div></div>
           <div className="flex items-center justify-between mt-2">
            <div className="text- opacity-60">👁 {ev.views} • ⭐ {ev.avg_rating.toFixed(1)} ({ev.rating_count})</div>
            {currentRole==='user' && <button onClick={()=>toggleSave(ev.id)} className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs ${savedIds.includes(ev.id)?'bg-black text-white':'bg-white dark:bg-[#2A2A2A]'}`}>{savedIds.includes(ev.id)?'♥':'♡'}</button>}
           </div>
          </div>
         </div>
        )
       })}
      </div>
     )}
   </div>

   {/* ADMIN DASHBOARD - FIX USER COUNT */}
   {currentRole==='admin' && (
    <div className="max-w- mx-auto px-4 mt-8">
     <div className="rounded- bg-white dark:bg-[#1A1A1A] border p-6">
      <div className="font-black text-lg">Admin Dashboard • Total User {registeredUsers.length} terdaftar</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
       <div className="p-4 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border"><div className="text-xs opacity-60">Total User</div><div className="font-black text-xl">{registeredUsers.length}</div><div className="text- opacity-50">terdaftar</div></div>
       <div className="p-4 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border"><div className="text-xs opacity-60">Total Event</div><div className="font-black text-xl">{events.length}</div></div>
       <div className="p-4 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border"><div className="text-xs opacity-60">Pending</div><div className="font-black text-xl text-orange-500">{events.filter(e=>e.moderation_status==='Pending').length}</div></div>
       <div className="p-4 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border"><div className="text-xs opacity-60">Approved</div><div className="font-black text-xl text-green-600">{events.filter(e=>e.moderation_status==='Approved').length}</div></div>
      </div>
      <div className="flex gap-2 mt-6">
       <button onClick={()=>setAdminTab("moderation")} className={`h-10 px-4 rounded-full font-bold text-sm ${adminTab==='moderation'?'bg-black text-white':'border'}`}>Moderasi</button>
       <button onClick={()=>setAdminTab("users")} className={`h-10 px-4 rounded-full font-bold text-sm ${adminTab==='users'?'bg-black text-white':'border'}`}>Users ({registeredUsers.length})</button>
      </div>
      {adminTab==='moderation' && <div className="mt-6 grid gap-3">{events.length===0?<div className="text-sm opacity-60 text-center py-8">Belum ada event</div>:events.map(ev=>(<div key={ev.id} className="p-4 rounded-xl border flex items-center gap-4"><img src={ev.poster_url} className="w-16 h-20 object-cover rounded-xl" /><div className="flex-1"><div className="font-bold text-sm">{ev.title}</div><div className="text-xs opacity-60">{ev.organizer_name} • {ev.moderation_status} {ev.is_sponsored&&`• Sponsor P${ev.sponsored_priority}`}</div></div><div className="flex gap-1 flex-wrap"><button onClick={()=>handleModeration(ev.id,'Approved')} className="h-8 px-3 rounded-full bg-green-600 text-white font-bold text-xs">Approve</button><button onClick={()=>handleModeration(ev.id,'Rejected')} className="h-8 px-3 rounded-full bg-[#E53935] text-white font-bold text-xs">Reject</button><button onClick={()=>handleModeration(ev.id,'Hidden')} className="h-8 px-3 rounded-full border font-bold text-xs">Hidden</button><button onClick={()=>handleModeration(ev.id,ev.moderation_status,true,1)} className="h-8 px-3 rounded-full bg-[#FFD600] text-black font-bold text-xs">Sponsor</button>{ev.is_sponsored&&<button onClick={()=>handleModeration(ev.id,ev.moderation_status,false)} className="h-8 px-3 rounded-full border font-bold text-xs">UnSponsor</button>}<button onClick={async()=>{ if(confirm('Hapus permanen?')){ await supabase.from('events').delete().eq('id',ev.id); setEvents(prev=>prev.filter(e=>e.id!==ev.id)); } }} className="h-8 px-3 rounded-full border font-bold text-xs">Hapus</button></div></div>))}</div>}
      {adminTab==='users' && <div className="mt-6"><div className="font-bold mb-3">Total {registeredUsers.length} user terdaftar</div><div className="grid gap-2">{registeredUsers.map(u=>(<div key={u.id} className="p-3 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border flex gap-3 items-center"><img src={u.avatar_url||`https://ui-avatars.com/api/?name=${u.display_name}&background=E53935&color=fff`} className="w-10 h-10 rounded-full object-cover border" /><div><div className="font-bold text-sm">@{u.username} • {u.display_name}</div><div className="text-xs opacity-60">{u.bio||'-'} • {new Date(u.created_at).toLocaleDateString()}</div></div><div className="ml-auto text-xs font-bold">{events.filter(e=>e.organizer_id===u.id).length} event</div></div>))}</div></div>}
      <div className="mt-8 pt-6 border-t">
       <div className="font-bold text-sm">Ganti PIN Admin</div>
       <div className="mt-3 flex gap-2"><input id="admin-old-pin" type="password" placeholder="PIN lama" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm flex-1" /><input id="admin-new-pin" type="password" placeholder="PIN baru 4 digit" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm flex-1" /><button onClick={async()=>{ const oldP=(document.getElementById('admin-old-pin') as HTMLInputElement)?.value; const newP=(document.getElementById('admin-new-pin') as HTMLInputElement)?.value; if(oldP!==adminPin){ setToast("PIN lama salah"); setTimeout(()=>setToast(""),2000); return; } if(!newP||newP.length<4){ setToast("PIN min 4"); setTimeout(()=>setToast(""),2000); return; } await supabase.from('admin_settings').upsert({ setting_key:'admin_pin', setting_value:newP },{onConflict:'setting_key'}); setAdminPin(newP); setToast("PIN diganti"); setTimeout(()=>setToast(""),2000); }} className="h-11 px-5 rounded-full bg-black text-white font-bold text-sm">Ganti</button></div>
       <div className="text- opacity-50 mt-2">PIN sekarang: {adminPin}</div>
      </div>
     </div>
    </div>
   )}

   {/* DETAIL MODAL */}
   {selectedEvent && (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
     <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setSelectedEvent(null)}></div>
     <div className="relative w-full max-w- rounded- bg-white dark:bg-[#1A1A1A] border shadow-2xl max-h- overflow-auto">
      <button onClick={()=>setSelectedEvent(null)} className="absolute top-4 right-4 z-[100] w-11 h-11 rounded-full bg-black text-white flex items-center justify-center font-bold">✕</button>
      <div className="aspect-[3/4] relative bg-[#F3F3F3]"><img src={selectedEvent.poster_url} className="w-full h-full object-cover" />{selectedEvent.is_sponsored&&<div className="absolute top-4 left-4 bg-[#FFD600] text-black text-xs font-black px-3 py-1 rounded-full">★ SPONSOR</div>}<div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs font-bold px-3 py-1 rounded-full">{getTimeStatus(selectedEvent)}</div></div>
      <div className="p-6">
       <div className="font-black text-xl leading-tight">{selectedEvent.title}</div>
       <div className="flex items-center gap-2 mt-3">
        <div className="h-9 px-4 rounded-full bg-[#F3F3F3] dark:bg-[#2A2A2A] border font-bold text-xs flex items-center gap-2">
         <span>👤 {selectedEvent.organizer_name}</span>
        </div>
        <div className="text-xs opacity-60">👁 {selectedEvent.views} • {selectedEvent.city}, {selectedEvent.province}</div>
       </div>
       <div className="flex flex-wrap gap-1.5 mt-3">{selectedEvent.categories.map(c=><span key={c} className="text- font-bold px-2.5 py-1 rounded-full bg-black text-white">{c}</span>)}<span className="text- font-bold px-2.5 py-1 rounded-full border">{selectedEvent.ticket_type}</span></div>
       <div className="mt-4 text-sm opacity-80 leading-relaxed whitespace-pre-wrap">{selectedEvent.description}</div>
       <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="p-3 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border"><div className="opacity-60">Tanggal</div><div className="font-bold">{selectedEvent.start_date} {selectedEvent.start_time} - {selectedEvent.end_date} {selectedEvent.end_time}</div></div><div className="p-3 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border"><div className="opacity-60">Alamat</div><div className="font-bold">{selectedEvent.venue_address}, {selectedEvent.city}</div></div></div>
       <div className="mt-4 grid gap-2">
        {selectedEvent.ticket_url && <a href={selectedEvent.ticket_url} target="_blank" className="h-11 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm">Beli Tiket</a>}
        {selectedEvent.registration_url && <a href={selectedEvent.registration_url} target="_blank" className="h-11 rounded-full border font-bold text-sm flex items-center justify-center">Daftar Lomba</a>}
        {currentRole==='user' && selectedEvent.organizer_id===currentUserId && <a href={`https://wa.me/6281381067774?text=Halo%20Makicos,%20saya%20ingin%20mempromosikan%20event%20${encodeURIComponent(selectedEvent.title)}%20(${selectedEvent.id})`} target="_blank" className="h-11 rounded-full bg-[#25D366] text-white flex items-center justify-center font-bold text-sm">📣 Promosikan Event via WA</a>}
        {currentRole==='user' && selectedEvent.organizer_id===currentUserId && <div className="grid grid-cols-2 gap-2"><button onClick={()=>{ setEditingEvent(selectedEvent); setNewCategories(selectedEvent.categories as any); setNewTicketType(selectedEvent.ticket_type); setPosterPreview(selectedEvent.poster_url); setSelectedEvent(null); setEventFormOpen(true); }} className="h-11 rounded-full border font-bold text-sm">Edit</button><button onClick={async()=>{ if(confirm('Hapus event?')){ await supabase.from('events').delete().eq('id',selectedEvent.id); setEvents(prev=>prev.filter(e=>e.id!==selectedEvent.id)); setSelectedEvent(null); setToast("Event dihapus"); setTimeout(()=>setToast(""),2000); } }} className="h-11 rounded-full bg-[#E53935] text-white font-bold text-sm">Hapus</button></div>}
       </div>

       {/* Rating - User only - FIX AVATAR */}
       <div className="mt-8 pt-6 border-t">
        <div className="font-bold">Rating ({selectedEvent.rating_count} • {selectedEvent.avg_rating.toFixed(1)}/10)</div>
        {currentRole==='user' ? (
         <div className="mt-3">
          <div className="flex gap-1 flex-wrap">{[1,2,3,4,5,6,7,8,9,10].map(n=><button key={n} onClick={()=>handleRate(selectedEvent.id,n)} className={`w-9 h-9 rounded-full font-bold text-sm border ${myRatings[selectedEvent.id]===n?'bg-black text-white':'bg-white dark:bg-[#2A2A2A]'}`}>{n}</button>)}</div>
          {myRatings[selectedEvent.id] && <div className="text-xs opacity-60 mt-2">Kamu rating {myRatings[selectedEvent.id]}/10</div>}
          <div className="mt-4 flex gap-2"><input value={commentText} onChange={e=>setCommentText(e.target.value)} placeholder="Tulis komentar..." className="flex-1 h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><button onClick={handleAddComment} className="h-11 px-5 rounded-full bg-black text-white font-bold text-sm">Kirim</button></div>
         </div>
        ) : <div className="text-xs opacity-60 mt-2">Login sebagai user untuk rating & komentar</div>}
        <div className="mt-4 grid gap-3">
         {reviews.filter(r=>r.event_id===selectedEvent.id).slice(0,20).map(r=>{
          const u = getUserById(r.user_id);
          return (
           <div key={r.id} className="p-3 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border flex gap-3">
            <img src={u?.avatar_url||`https://ui-avatars.com/api/?name=${encodeURIComponent(u?.display_name||'U')}&background=E53935&color=fff`} className="w-9 h-9 rounded-full object-cover border shrink-0" />
            <div className="flex-1 min-w-0">
             <div className="flex justify-between items-center gap-2">
              <div className="font-bold text-xs truncate">{u?.display_name||'User'} • @{u?.username||'user'}</div>
              <div className="text- opacity-60 shrink-0">{new Date(r.created_at).toLocaleDateString()} • ⭐ {r.rating}/10</div>
             </div>
             {r.comment&&<div className="text-sm mt-1 break-words">{r.comment}</div>}
            </div>
           </div>
          )
         })}
        </div>
       </div>

       {/* Dokumentasi - only Completed - doc 10MB */}
       <div className="mt-8 pt-6 border-t">
        <div className="font-bold">Dokumentasi {getTimeStatus(selectedEvent)==='Completed'?'(Event selesai)':'(Hanya untuk event Completed)'}</div>
        <div className="text- opacity-60">Max 10MB per foto</div>
        {currentRole==='user' && getTimeStatus(selectedEvent)==='Completed' && (
         <div className="mt-3 p-4 rounded-xl border-2 border-dashed grid gap-2"><input type="file" accept="image/*" onChange={e=>setDocFile(e.target.files?.[0]||null)} className="text-xs" /><input value={docCaption} onChange={e=>setDocCaption(e.target.value)} placeholder="Caption" className="h-10 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-3 text-sm" /><button onClick={handleUploadDoc} className="h-10 rounded-full bg-black text-white font-bold text-sm">Upload Dokumentasi (max 10MB)</button></div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">{docs.filter(d=>d.event_id===selectedEvent.id).map(d=><div key={d.id} className="rounded-xl overflow-hidden border"><img src={d.image_url} className="w-full aspect-square object-cover" /><div className="p-2"><div className="text-xs font-bold truncate">{d.username}</div><div className="text- opacity-60 truncate">{d.caption}</div></div></div>)}</div>
       </div>

       <div className="mt-8 text- opacity-50">ID: {selectedEvent.id} • {selectedEvent.organizer_name}</div>
      </div>
     </div>
    </div>
   )}

   {/* AUTH MODALS */}
   {showLoginUser && <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/60" onClick={()=>setShowLoginUser(false)}></div><div className="relative w-full max-w- rounded- bg-white dark:bg-[#1A1A1A] border p-6"><div className="font-black text-lg">Masuk User</div><div className="mt-5 grid gap-3"><input id="login-user-u" placeholder="Username" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><input id="login-user-p" type="password" placeholder="Password" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /></div><button onClick={handleLoginUser} className="mt-5 w-full h-11 rounded-full bg-black text-white font-bold text-sm">Masuk</button><button onClick={()=>{ setShowLoginUser(false); setShowRegUser(true); }} className="mt-3 w-full text-xs opacity-60">Belum punya akun? Daftar</button></div></div>}
   {showRegUser && <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/60" onClick={()=>setShowRegUser(false)}></div><div className="relative w-full max-w- rounded- bg-white dark:bg-[#1A1A1A] border p-6"><div className="font-black text-lg">Daftar User</div><div className="mt-5 grid gap-3"><input id="reg-user-u" placeholder="Username kecil min 3" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><input id="reg-user-d" placeholder="Display name" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><input id="reg-user-p" type="password" placeholder="Password min 8 huruf+angka" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /></div><button onClick={handleRegUser} className="mt-5 w-full h-11 rounded-full bg-black text-white font-bold text-sm">Daftar</button></div></div>}
   {showAdmin && currentRole!=="admin" && <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/60" onClick={()=>setShowAdmin(false)}></div><div className="relative w-full max-w- rounded- bg-white dark:bg-[#1A1A1A] border p-6"><div className="font-black text-lg">Admin</div><div className="mt-5 grid gap-3"><input id="admin-user" placeholder="Username Admin" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm outline-none" /><input id="admin-pin" type="password" placeholder="PIN" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm outline-none" /></div><button onClick={handleLoginAdmin} className="mt-5 w-full h-11 rounded-full bg-black text-white font-bold text-sm">Masuk Admin</button><div className="mt-3 text- opacity-50 text-center">Klik logo 5x dalam 4 detik atau Ctrl+Shift+A</div></div></div>}

   {/* USER PROFILE - FIX AVATAR CROP 1:1 max 3MB */}
   {showUserProfile && <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/60" onClick={()=>setShowUserProfile(false)}></div><div className="relative w-full max-w- rounded- bg-white dark:bg-[#1A1A1A] border p-6 max-h- overflow-auto"><div className="font-black text-lg">Edit Profil • Bio & Avatar 1:1 max 3MB</div><div className="mt-5 grid gap-4"><div className="flex gap-4"><img src={registeredUsers.find(u=>u.id===currentUserId)?.avatar_url||`https://ui-avatars.com/api/?name=${currentUser}&background=E53935&color=fff`} className="w-16 h-16 rounded-full object-cover border" /><div className="flex-1"><div className="text-xs font-bold">Avatar 1:1 max 3MB + crop manual</div><input type="file" accept="image/*" onChange={e=>{
     const f=e.target.files?.[0]; if(!f) return;
     if(f.size>3*1024*1024){ setToast("Max 3MB"); setTimeout(()=>setToast(""),2000); return; }
     setAvatarToCrop(URL.createObjectURL(f));
     setAvatarZoom(1); setAvatarPos({x:0,y:0});
     setShowAvatarCrop(true);
   }} className="mt-2 text-xs w-full" />{userAvatarFile&&<div className="mt-2 text- text-green-600">✓ {userAvatarFile.name} siap</div>}</div></div><input id="edit-user-display" defaultValue={currentUser} placeholder="Display name" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><textarea id="edit-user-bio" defaultValue={registeredUsers.find(u=>u.id===currentUserId)?.bio||""} placeholder="Bio" className="min-h- rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border p-3 text-sm" /></div><button onClick={handleUpdateUserProfile} className="mt-5 w-full h-11 rounded-full bg-black text-white font-bold text-sm">Simpan Profil (bio tetap setelah refresh)</button><div className="mt-8 pt-6 border-t"><div className="font-bold text-sm">Ganti Password</div><div className="mt-3 grid gap-3"><input id="edit-user-oldpass" type="password" placeholder="Password lama" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><input id="edit-user-newpass" type="password" placeholder="Baru min 8 huruf+angka" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><button onClick={handleChangeUserPassword} className="h-11 rounded-full border font-bold text-sm">Ganti Password</button></div></div></div></div>}

   {/* AVATAR CROP MODAL */}
   {showAvatarCrop && <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/80" onClick={()=>setShowAvatarCrop(false)}></div><div className="relative w-full max-w- rounded- bg-white dark:bg-[#1A1A1A] border p-6"><div className="font-black">Crop Avatar 1:1</div><div className="text-xs opacity-60 mt-1">Geser posisi + zoom, max 3MB</div><div className="mt-4 w-full aspect-square rounded-full overflow-hidden border-2 bg-[#F3F3F3] dark:bg-[#2A2A2A] relative"><img ref={avatarImgRef} src={avatarToCrop} className="w-full h-full object-cover" style={{ transform:`translate(${avatarPos.x}px, ${avatarPos.y}px) scale(${avatarZoom})`, cursor:'move' }} draggable={false} onMouseDown={e=>{ const sx=e.clientX-avatarPos.x; const sy=e.clientY-avatarPos.y; const move=(ev:MouseEvent)=>setAvatarPos({x:ev.clientX-sx, y:ev.clientY-sy}); const up=()=>{ window.removeEventListener('mousemove',move); window.removeEventListener('mouseup',up); }; window.addEventListener('mousemove',move); window.addEventListener('mouseup',up); }} /></div><div className="mt-4 grid gap-3"><div><div className="text-xs font-bold">Zoom</div><input type="range" min={0.5} max={3} step={0.1} value={avatarZoom} onChange={e=>setAvatarZoom(Number(e.target.value))} className="w-full" /></div><div className="grid grid-cols-2 gap-2"><button onClick={()=>setAvatarPos({x:0,y:0})} className="h-10 rounded-full border font-bold text-xs">Reset Posisi</button><button onClick={()=>setAvatarZoom(1)} className="h-10 rounded-full border font-bold text-xs">Reset Zoom</button></div><button onClick={handleAvatarCropSave} className="h-11 rounded-full bg-black text-white font-bold text-sm">Crop & Gunakan</button><button onClick={()=>setShowAvatarCrop(false)} className="h-10 rounded-full border font-bold text-sm">Batal</button></div></div></div>}

   {/* EO FORM - with time */}
   {eventFormOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/60" onClick={()=>setEventFormOpen(false)}></div><div className="relative w-full max-w- rounded- bg-white dark:bg-[#1A1A1A] border p-6 max-h- overflow-auto"><div className="font-black text-lg">{editingEvent?"Edit Event":"Upload Event Baru"}</div><div className="text-xs opacity-60 mt-1">Poster 3:4 max 3MB • Doc max 10MB</div><div className="mt-5 grid gap-4"><input id="new-title" defaultValue={editingEvent?.title||""} placeholder="Nama event" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><textarea id="new-desc" defaultValue={editingEvent?.description||""} placeholder="Deskripsi min 20 karakter" className="min-h- rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border p-3 text-sm" /><div className="p-4 rounded- border-2 border-dashed"><div className="text-xs font-bold">Poster 3:4 max 3MB</div><input type="file" accept="image/*" onChange={e=>{ const f=e.target.files?.[0]; if(f) handlePosterUpload(f, setPosterPreview); }} className="mt-2 w-full text-xs" />{posterPreview&&<img src={posterPreview} className="mt-3 w-full h-48 object-cover rounded-xl border" />}{posterError&&<div className="mt-2 text- text-[#E53935] bg-[#E53935]/10 p-2 rounded-xl border border-[#E53935]/20">{posterError}</div>}</div><div className="p-4 rounded- bg-[#F7F7F8] dark:bg-[#2A2A2A] border"><div className="text-xs font-bold mb-2">Kategori</div><div className="grid grid-cols-2 gap-2">{eventCategoryOptions.map(cat=>{ const checked=newCategories.includes(cat); return (<label key={cat} className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer ${checked?"bg-black text-white":"bg-white dark:bg-[#1E1E1E]"}`}><input type="checkbox" checked={checked} onChange={e=>{ if(e.target.checked) setNewCategories(prev=>[...prev,cat]); else setNewCategories(prev=>prev.filter(c=>c!==cat)); }} className="w-4 h-4" /><span className="text-xs font-bold">{cat}</span></label>)})}</div></div><div className="grid grid-cols-2 gap-2"><select value={newTicketType} onChange={e=>setNewTicketType(e.target.value as TicketType)} className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm"><option>Gratis</option><option>Berbayar</option></select><select id="new-prov" defaultValue={editingEvent?.province||"Banten"} className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm">{ALL_PROVINCES.map(p=><option key={p}>{p}</option>)}</select></div><div className="grid grid-cols-2 gap-2"><input id="new-city" defaultValue={editingEvent?.city||""} placeholder="Kota" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><input id="new-venue" defaultValue={editingEvent?.venue_address||""} placeholder="Alamat" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /></div>{newTicketType==="Berbayar"&&<input id="new-ticket-url" defaultValue={editingEvent?.ticket_url||""} placeholder="Link tiket wajib jika berbayar" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />}<input id="new-lomba-url" defaultValue={editingEvent?.registration_url||""} placeholder="Link lomba opsional" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><div className="grid grid-cols-2 gap-2"><input id="new-start" defaultValue={editingEvent?.start_date||""} type="date" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><input id="new-end" defaultValue={editingEvent?.end_date||""} type="date" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /></div><div className="grid grid-cols-2 gap-2"><input id="new-start-time" defaultValue={editingEvent?.start_time||"09:00"} type="time" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><input id="new-end-time" defaultValue={editingEvent?.end_time||"18:00"} type="time" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /></div></div><button onClick={handleCreateEvent} className="mt-5 w-full h-12 rounded-full bg-black text-white font-bold text-sm">{editingEvent?"Simpan Perubahan":"Upload Event"}</button><div className="mt-2 text- opacity-50 text-center">Event akan direview admin sebelum tampil • WA Promosi: wa.me/6281381067774</div></div></div>}

   {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-5 py-2.5 rounded-full text-sm z-[90] shadow-xl border border-white/10 max-w- text-center">{toast}</div>}
   <footer className="border-t mt-12 py-8"><div className="max-w- mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3"><div className="flex items-center gap-3"><img src="/logo.png" alt="NGIPEN" className="w-8 h-8 rounded-xl object-contain bg-white" /><div><div className="font-black text-sm">NGIPEN</div><div className="text- opacity-60">Satu Hobby Satu Keseruan • {approvedEvents.length} event • {registeredUsers.length} user</div></div></div><div className="text- opacity-50">© 2026 Makicos ID • Rangkasbitung, Banten • wa.me/6281381067774</div></div></footer>
  </div>
 );
}
