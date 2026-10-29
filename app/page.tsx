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
 const [commentText,setCommentText]=useState("");
 const [docFile,setDocFile]=useState<File|null>(null);
 const [docCaption,setDocCaption]=useState("");
 const [userAvatarFile,setUserAvatarFile]=useState<File|null>(null);
 // FIX AVATAR CROP - 280px fixed
 const [showAvatarCrop,setShowAvatarCrop]=useState(false);
 const [avatarToCrop,setAvatarToCrop]=useState("");
 const [avatarZoom,setAvatarZoom]=useState(1);
 const [avatarPos,setAvatarPos]=useState({x:0,y:0});
 const avatarImgRef = useRef<HTMLImageElement>(null);
 const isDragging = useRef(false);
 const lastPos = useRef({x:0,y:0});

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

 useEffect(()=>{
  async function fetchAll(){
   setLoading(true);
   try{
    const { data: pinData } = await supabase.from('admin_settings').select('*').eq('setting_key','admin_pin').maybeSingle();
    if(pinData?.setting_value) setAdminPin(String(pinData.setting_value).replace(/"/g,''));
    const { data: usersData } = await supabase.from('users').select('*').order('created_at',{ascending:false});
    if(usersData) setRegisteredUsers(usersData as any);
    const { data: eventsData } = await supabase.from('events').select('*').order('created_at',{ascending:false});
    if(eventsData) setEvents(eventsData as any);
    const savedUserId = localStorage.getItem('ngipen_user_id');
    if(savedUserId){
     const { data: saves } = await supabase.from('saves').select('*').eq('user_id',savedUserId);
     if(saves) setSavedIds(saves.map((s:any)=>s.event_id));
     else {
      const { data: saves2 } = await supabase.from('event_saves').select('*').eq('user_id',savedUserId);
      if(saves2) setSavedIds(saves2.map((s:any)=>s.event_id));
     }
     const { data: revs } = await supabase.from('ratings').select('*').eq('user_id',savedUserId);
     if(revs){ const m:Record<string,number>={}; revs.forEach((r:any)=>m[r.event_id]=r.rating); setMyRatings(m); }
    }
    const { data: allReviews } = await supabase.from('ratings').select('*').order('created_at',{ascending:false});
    if(allReviews) setReviews(allReviews as any);
    else {
     const { data: all2 } = await supabase.from('event_reviews').select('*').order('created_at',{ascending:false});
     if(all2) setReviews(all2 as any);
    }
    const { data: docsData } = await supabase.from('documentations').select('*').order('created_at',{ascending:false});
    if(docsData) setDocs(docsData as any);
   }catch(e){ console.error(e); }finally{ setLoading(false); }
  }
  fetchAll();
 },[]);

 const uploadToBucket = async (file:File, bucket:string): Promise<string>=>{
  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g,'_')}`;
  const { error } = await supabase.storage.from(bucket).upload(fileName, file, { upsert:true });
  if(error){
   if(bucket==='avatars'){
    const { error: e2 } = await supabase.storage.from('posters').upload(fileName, file, { upsert:true });
    if(!e2){ const { data } = supabase.storage.from('posters').getPublicUrl(fileName); return data.publicUrl; }
   }
   throw error;
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
 };

 const handlePosterUpload = (file:File, setter:(s:string)=>void)=>{
  setPosterError("");
  if(file.size>3*1024*1024){ setPosterError("Max 3MB"); return; }
  const img = new Image(); img.onload=()=>{ if(Math.abs((img.width/img.height)-0.75)>0.15) setPosterError("Rasio harus 3:4"); else { setPosterFile(file); setter(URL.createObjectURL(file)); } }; img.src=URL.createObjectURL(file);
 };

 const handleLoginUser = async()=>{
  const u = (document.getElementById('login-user-u') as HTMLInputElement)?.value?.trim().toLowerCase();
  const p = (document.getElementById('login-user-p') as HTMLInputElement)?.value;
  const { data } = await supabase.from('users').select('*').eq('username',u).maybeSingle();
  if(!data || (data as any).password_hash!==p){ setToast("Username/password salah"); return; }
  localStorage.setItem('ngipen_role','user'); localStorage.setItem('ngipen_user',data.display_name); localStorage.setItem('ngipen_user_id',data.id);
  setCurrentRole('user'); setCurrentUser(data.display_name); setCurrentUserId(data.id);
  setShowLoginUser(false); setToast(`Halo ${data.display_name}`);
 };
 const handleRegUser = async()=>{
  const username = (document.getElementById('reg-user-u') as HTMLInputElement)?.value?.trim().toLowerCase();
  const display = (document.getElementById('reg-user-d') as HTMLInputElement)?.value?.trim();
  const pass = (document.getElementById('reg-user-p') as HTMLInputElement)?.value;
  if(!username||username.length<3){ setToast("Username min 3"); return; }
  if(!pass||pass.length<8){ setToast("Password min 8 huruf+angka"); return; }
  const { data: exist } = await supabase.from('users').select('id').eq('username',username).maybeSingle(); if(exist){ setToast("Username dipakai"); return; }
  const { data } = await supabase.from('users').insert({ username, password_hash:pass, display_name:display||username, bio:'', avatar_url:'' }).select().single();
  if(data) setRegisteredUsers(prev=>[data as any,...prev]);
  setShowRegUser(false); setToast("Daftar berhasil, login");
 };
 const handleLoginAdmin = async()=>{
  const u = (document.getElementById('admin-user') as HTMLInputElement)?.value?.trim();
  const p = (document.getElementById('admin-pin') as HTMLInputElement)?.value?.trim();
  const { data } = await supabase.from('admin_settings').select('*').eq('setting_key','admin_pin').maybeSingle();
  if(data && String(data.setting_value).replace(/"/g,'')===p){ localStorage.setItem('ngipen_role','admin'); setCurrentRole('admin'); setShowAdmin(false); setToast("Admin login"); return; }
  if(u==='makicos' && (p==='1111' || p===adminPin)){ localStorage.setItem('ngipen_role','admin'); setCurrentRole('admin'); setShowAdmin(false); setToast("Admin login"); return; }
  setToast("Admin salah");
 };
 const logout = ()=>{
  localStorage.removeItem('ngipen_role'); localStorage.removeItem('ngipen_user'); localStorage.removeItem('ngipen_user_id');
  setCurrentRole('guest'); setCurrentUser(''); setCurrentUserId(''); setSavedIds([]); setMyRatings({}); setMobileOpen(false); setToast("Logout");
 };

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
  if(!title||title.length<3){ setToast("Judul min 3"); return; }
  if(!desc||desc.length<20){ setToast("Deskripsi min 20"); return; }
  if(!posterFile && !editingEvent){ setToast("Poster wajib"); return; }
  try{
   let posterUrl = editingEvent?.poster_url||"";
   if(posterFile) posterUrl = await uploadToBucket(posterFile,'posters');
   const payload:any = {
    organizer_id: currentUserId, title, slug: slugify(title), description:desc, poster_url:posterUrl,
    categories:newCategories, province:prov, city, venue_address:venue,
    start_date:start, end_date:end, start_time:'09:00', end_time:'18:00',
    ticket_type:newTicketType, ticket_url:ticketUrl||null, registration_url:lombaUrl||null,
    moderation_status:'Pending', is_sponsored:false, sponsored_priority:0,
    views:0, saves_count:0, avg_rating:0, rating_count:0, organizer_name:currentUser
   };
   const { data, error } = editingEvent ? await supabase.from('events').update({...payload, moderation_status:'Pending'}).eq('id',editingEvent.id).select().single() : await supabase.from('events').insert(payload).select().single();
   if(error) throw error;
   if(editingEvent) setEvents(prev=>prev.map(e=>e.id===editingEvent.id?{...e,...data} as Event:e));
   else setEvents(prev=>[{...data, organizer_name:currentUser} as Event, ...prev]);
   setEventFormOpen(false); setEditingEvent(null); setPosterFile(null); setPosterPreview(""); setToast("Menunggu approval admin");
  }catch(e:any){ setToast("Gagal: "+e.message); }
 };

 const handleModeration = async(id:string, status:ModStatus, sponsor?:boolean, priority?:number)=>{
  const update:any = { moderation_status:status };
  if(sponsor!==undefined) update.is_sponsored=sponsor;
  if(priority!==undefined) update.sponsored_priority=priority;
  await supabase.from('events').update(update).eq('id',id);
  setEvents(prev=>prev.map(e=>e.id===id?{...e,...update}:e));
  setToast(`Event ${status}`);
 };

 const toggleSave = async(eventId:string)=>{
  if(currentRole!=='user'){ setShowLoginUser(true); return; }
  const isSaved = savedIds.includes(eventId);
  if(isSaved){ await supabase.from('saves').delete().eq('user_id',currentUserId).eq('event_id',eventId); setSavedIds(prev=>prev.filter(id=>id!==eventId)); }
  else { await supabase.from('saves').insert({ user_id:currentUserId, event_id:eventId }); setSavedIds(prev=>[...prev,eventId]); }
 };
 const handleRate = async(eventId:string, rating:number)=>{
  if(currentRole!=='user'){ setShowLoginUser(true); return; }
  const { data: exist } = await supabase.from('ratings').select('*').eq('user_id',currentUserId).eq('event_id',eventId).maybeSingle();
  if(exist) await supabase.from('ratings').update({ rating }).eq('id',exist.id); else await supabase.from('ratings').insert({ user_id:currentUserId, event_id:eventId, rating });
  setMyRatings(prev=>({...prev,[eventId]:rating}));
  const { data: all } = await supabase.from('ratings').select('*').eq('event_id',eventId);
  if(all){ const avg = (all as any).reduce((s:any,r:any)=>s+r.rating,0)/all.length; await supabase.from('events').update({ avg_rating:avg, rating_count:all.length }).eq('id',eventId); setEvents(prev=>prev.map(e=>e.id===eventId?{...e, avg_rating:avg, rating_count:all.length}:e)); if(selectedEvent?.id===eventId) setSelectedEvent(prev=>prev?{...prev, avg_rating:avg, rating_count:all.length}:null); }
  setToast(`Rating ${rating} disimpan`);
 };
 const handleAddComment = async()=>{
  if(!selectedEvent) return;
  if(currentRole!=='user'){ setShowLoginUser(true); return; }
  if(!commentText.trim()){ setToast("Tulis komentar"); return; }
  const { data } = await supabase.from('ratings').insert({ user_id:currentUserId, event_id:selectedEvent.id, rating: myRatings[selectedEvent.id]||5, comment: commentText.trim() }).select().single();
  if(data) setReviews(prev=>[data as any, ...prev]); setCommentText(""); setToast("Komentar terkirim");
 };
 const handleAddDoc = async()=>{
  if(!selectedEvent||!docFile) return;
  if(docFile.size>10*1024*1024){ setToast("Max 10MB"); return; }
  const url = await uploadToBucket(docFile,'documentations');
  const { data } = await supabase.from('documentations').insert({ event_id:selectedEvent.id, user_id:currentUserId, username:currentUser, image_url:url, caption:docCaption }).select().single();
  if(data) setDocs(prev=>[data as any, ...prev]); setDocFile(null); setDocCaption(""); setToast("Dokumentasi diupload");
 };
 const handleUpdateUserProfile = async()=>{
  const display = (document.getElementById('edit-user-display') as HTMLInputElement)?.value?.trim();
  const bio = (document.getElementById('edit-user-bio') as HTMLTextAreaElement)?.value?.trim() || "";
  let avatarUrl = registeredUsers.find(u=>u.id===currentUserId)?.avatar_url || "";
  if(userAvatarFile){ avatarUrl = await uploadToBucket(userAvatarFile,'avatars'); }
  await supabase.from('users').update({ display_name:display, bio, avatar_url:avatarUrl }).eq('id',currentUserId);
  // FIX BIO TETAP SETELAH REFRESH + SYNC HP-PC
  setRegisteredUsers(prev=> prev.map(u=> u.id===currentUserId ? { ...u, display_name: display||currentUser, bio, avatar_url: avatarUrl } : u));
  setCurrentUser(display||currentUser); localStorage.setItem('ngipen_user', display||currentUser);
  setToast("Profil disimpan"); setShowUserProfile(false); setUserAvatarFile(null);
 };
 const handleChangeUserPassword = async()=>{
  const oldPass = (document.getElementById('edit-user-oldpass') as HTMLInputElement)?.value;
  const newPass = (document.getElementById('edit-user-newpass') as HTMLInputElement)?.value;
  const { data } = await supabase.from('users').select('*').eq('id',currentUserId).maybeSingle();
  if(!data || data.password_hash!==oldPass){ setToast("Password lama salah"); return; }
  await supabase.from('users').update({ password_hash:newPass }).eq('id',currentUserId);
  setToast("Password diganti");
 };

 // FIX FILTERED EVENTS - USER LIHAT SEMUA APPROVED
 const approvedEvents = useMemo(()=>events.filter(e=>e.moderation_status==='Approved'),[events]);
 const sponsoredEvents = useMemo(()=>approvedEvents.filter(e=>e.is_sponsored).sort((a,b)=>b.sponsored_priority-a.sponsored_priority).slice(0,10),[approvedEvents]);
 const filteredEvents = useMemo(()=>{
  let list = currentRole==='admin' ? events : approvedEvents;
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
 };

 return (
  <div className={`${dark?"dark bg-[#0F0F0F] text-white":"bg-[#FAFAF8] text-black"} min-h-screen`}>
   <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap'); *{font-family:'Plus Jakarta Sans',sans-serif}`}</style>

   <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-[#1A1A1A]/80 border-b">
    <div className="max-w- mx-auto px-4 h- flex items-center justify-between">
     <div className="flex items-center gap-3 cursor-pointer" onClick={()=>{ const c=logoClicks+1; setLogoClicks(c); if(c>=5){ setShowAdmin(true); setLogoClicks(0); } }}>
      <img src="/logo.png" alt="NGIPEN" className="w-9 h-9 object-contain rounded-xl" />
      <div><div className="font-black leading-none">NGIPEN</div><div className="text- tracking-widest opacity-60">SATU HOBBY SATU KESERUAN</div></div>
     </div>
     <div className="hidden md:flex items-center gap-2">
      {currentRole==='guest' && <><button onClick={()=>setShowLoginUser(true)} className="h-10 px-4 rounded-full border font-bold text-sm">Masuk</button><button onClick={()=>setShowRegUser(true)} className="h-10 px-4 rounded-full bg-black text-white font-bold text-sm">Daftar</button></>}
      {currentRole!=='guest' && <><div className="h-10 px-4 rounded-full bg-[#F3F3F3] dark:bg-[#2A2A2A] border flex items-center gap-2 text-sm font-bold">{currentRole.toUpperCase()} : {currentUser}</div>
       {currentRole==='user' && <button onClick={()=>setShowUserProfile(true)} className="h-10 px-4 rounded-full border font-bold text-sm">Profil</button>}
       {currentRole==='user' && <button onClick={()=>{ setEditingEvent(null); setEventFormOpen(true); setNewCategories(["Cosplay"]); }} className="h-10 px-5 rounded-full bg-[#E53935] text-white font-bold text-sm">Upload</button>}
       <button onClick={logout} className="h-10 w-10 rounded-full border font-bold">⎋</button></>}
      <button onClick={()=>{ const nd=!dark; setDark(nd); localStorage.setItem('ngipen_theme',nd?'dark':'light'); if(nd) document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark'); }} className="h-10 w-10 rounded-full border">{dark?'☀️':'🌙'}</button>
     </div>
     <button onClick={()=>setMobileOpen(!mobileOpen)} className="md:hidden w-11 h-11 rounded-full border flex items-center justify-center">☰</button>
    </div>
   </header>

   {sponsoredEvents.length>0 && (
    <div className="max-w- mx-auto px-4 mt-6">
     <div className="rounded- bg-white dark:bg-[#1A1A1A] border p-4">
      <div className="font-black flex items-center gap-2">★ Sponsor <span className="text-xs opacity-60">{sponsoredEvents.length}/10</span></div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
       {sponsoredEvents.map(ev=>(<div key={ev.id} onClick={()=>openDetail(ev)} className="cursor-pointer rounded- overflow-hidden border group"><div className="aspect-[3/4] relative"><img src={ev.poster_url} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" /><div className="absolute top-2 left-2 bg-[#FFD600] text-black text- font-black px-2 py-1 rounded-full">★ SPONSOR</div></div><div className="p-2"><div className="font-bold text-xs truncate">{ev.title}</div><div className="text- opacity-60">{ev.city}</div></div></div>))}
      </div>
     </div>
    </div>
   )}

   <div className="max-w- mx-auto px-4 mt-6">
    <div className="rounded- bg-white dark:bg-[#1A1A1A] border p-4 grid gap-3">
     <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari event..." className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />
      <select value={selectedProv} onChange={e=>{ setSelectedProv(e.target.value); setSelectedCity("Semua"); }} className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm"><option>Semua</option>{ALL_PROVINCES.map(p=><option key={p}>{p}</option>)}</select>
      <select value={selectedCity} onChange={e=>setSelectedCity(e.target.value)} className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm">{cityOptions.map(c=><option key={c}>{c}</option>)}</select>
      <select value={selectedCat} onChange={e=>setSelectedCat(e.target.value as any)} className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm"><option>Semua</option>{eventCategoryOptions.map(c=><option key={c}>{c}</option>)}</select>
      <select value={selectedTicket} onChange={e=>setSelectedTicket(e.target.value as any)} className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm"><option>Semua</option><option>Gratis</option><option>Berbayar</option></select>
     </div>
     <div className="flex items-center gap-2 flex-wrap">
      <button onClick={()=>setSortMode("Terbaru")} className={`h-9 px-4 rounded-full font-bold text-sm ${sortMode==='Terbaru'?'bg-black text-white':'bg-[#F3F3F3] border'}`}>Terbaru</button>
      <button onClick={()=>setSortMode("Terpopuler")} className={`h-9 px-4 rounded-full font-bold text-sm ${sortMode==='Terpopuler'?'bg-black text-white':'bg-[#F3F3F3] border'}`}>Terpopuler</button>
      {currentRole==='user' && <><button onClick={()=>setUserTab("Semua")} className={`h-9 px-4 rounded-full font-bold text-sm ${userTab==='Semua'?'bg-black text-white':'border'}`}>Semua</button><button onClick={()=>setUserTab("Tersimpan")} className={`h-9 px-4 rounded-full font-bold text-sm ${userTab==='Tersimpan'?'bg-black text-white':'border'}`}>Tersimpan ({savedIds.length})</button></>}
     </div>
    </div>
   </div>

   <div className="max-w- mx-auto px-4 mt-6">
    {loading ? <div className="text-center py-20 opacity-60">Memuat...</div> : filteredEvents.length===0 ? <div className="text-center py-20">Belum ada event</div> : (
     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {filteredEvents.map(ev=>{
       const timeStatus = getTimeStatus(ev);
       return (
        <div key={ev.id} className="rounded- overflow-hidden bg-white dark:bg-[#1A1A1A] border group">
         <div onClick={()=>openDetail(ev)} className="aspect-[3/4] relative cursor-pointer overflow-hidden bg-[#F3F3F3]">
          <img src={ev.poster_url} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
          {ev.is_sponsored && <div className="absolute top-2 left-2 bg-[#FFD600] text-black text- font-black px-2 py-1 rounded-full">★ SPONSOR</div>}
          <div className="absolute top-2 right-2 bg-black/70 text-white text- font-bold px-2 py-1 rounded-full">{timeStatus}</div>
         </div>
         <div className="p-3">
          <div onClick={()=>openDetail(ev)} className="cursor-pointer"><div className="font-bold text-sm leading-tight truncate">{ev.title}</div><div className="text- opacity-60 mt-1">{ev.city} • {ev.categories[0]}</div></div>
          <div className="flex items-center justify-between mt-2">
           <div className="text- opacity-60">👁 {ev.views} • ⭐ {ev.avg_rating.toFixed(1)}</div>
           {currentRole==='user' && <button onClick={()=>toggleSave(ev.id)} className={`w-8 h-8 rounded-full border text-xs ${savedIds.includes(ev.id)?'bg-black text-white':''}`}>{savedIds.includes(ev.id)?'♥':'♡'}</button>}
          </div>
         </div>
        </div>
       )
      })}
     </div>
    )}
   </div>

   {currentRole==='admin' && (
    <div className="max-w- mx-auto px-4 mt-8">
     <div className="rounded- bg-white dark:bg-[#1A1A1A] border p-6">
      <div className="font-black text-lg">Admin Dashboard • {registeredUsers.length} user • {events.length} event</div>
      <div className="flex gap-2 mt-4">
       <button onClick={()=>setAdminTab("moderation")} className={`h-10 px-4 rounded-full font-bold text-sm ${adminTab==='moderation'?'bg-black text-white':'border'}`}>Moderasi</button>
       <button onClick={()=>setAdminTab("users")} className={`h-10 px-4 rounded-full font-bold text-sm ${adminTab==='users'?'bg-black text-white':'border'}`}>Users ({registeredUsers.length})</button>
      </div>
      {adminTab==='moderation' && <div className="mt-6 grid gap-3">{events.map(ev=>(<div key={ev.id} className="p-4 rounded-xl border flex items-center gap-4"><img src={ev.poster_url} className="w-16 h-20 object-cover rounded-xl" /><div className="flex-1"><div className="font-bold text-sm">{ev.title}</div><div className="text-xs opacity-60">{ev.organizer_name} • {ev.moderation_status}</div></div><div className="flex gap-1 flex-wrap"><button onClick={()=>handleModeration(ev.id,'Approved')} className="h-8 px-3 rounded-full bg-green-600 text-white text-xs font-bold">Approve</button><button onClick={()=>handleModeration(ev.id,'Rejected')} className="h-8 px-3 rounded-full bg-red-600 text-white text-xs font-bold">Reject</button><button onClick={()=>handleModeration(ev.id,ev.moderation_status,true,1)} className="h-8 px-3 rounded-full bg-[#FFD600] text-black text-xs font-bold">Sponsor</button></div></div>))}</div>}
      {adminTab==='users' && <div className="mt-6 grid gap-2"><div className="text-xs font-bold mb-2">Total {registeredUsers.length} user terdaftar</div>{registeredUsers.map(u=>(<div key={u.id} className="p-3 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border"><div className="font-bold text-sm">@{u.username}</div><div className="text-xs opacity-60">{u.display_name} • {new Date(u.created_at).toLocaleDateString()}</div></div>))}</div>}
     </div>
    </div>
   )}

   {/* DETAIL MODAL - FIX ZOOM POSTER */}
   {selectedEvent && (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-0 md:p-4">
     <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setSelectedEvent(null)}></div>
     <div className="relative w-full max-w- rounded-t- md:rounded- bg-white dark:bg-[#1A1A1A] border shadow-2xl max-h- overflow-auto">
      <button onClick={()=>setSelectedEvent(null)} className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black text-white flex items-center justify-center">✕</button>
      {/* FIX: max-h 46vh object-contain biar deskripsi keliatan */}
      <div className="relative w-full max-h- bg-[#F3F3F3] flex items-center justify-center overflow-hidden shrink-0">
       <img src={selectedEvent.poster_url} className="w-auto h-auto max-w-full max-h- object-contain mx-auto block" />
       {selectedEvent.is_sponsored&&<div className="absolute top-4 left-4 bg-[#FFD600] text-black text-xs font-black px-3 py-1 rounded-full">★ SPONSOR</div>}
       <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs font-bold px-3 py-1 rounded-full">{getTimeStatus(selectedEvent)}</div>
      </div>
      <div className="p-6">
       <div className="font-black text-xl leading-tight">{selectedEvent.title}</div>
       <div className="flex flex-wrap gap-1.5 mt-3">{selectedEvent.categories.map(c=><span key={c} className="text- font-bold px-2.5 py-1 rounded-full bg-black text-white">{c}</span>)}<span className="text- font-bold px-2.5 py-1 rounded-full border">{selectedEvent.ticket_type}</span></div>
       <div className="mt-4 text-sm opacity-80 whitespace-pre-wrap leading-relaxed">{selectedEvent.description}</div>
       <div className="mt-4 p-3 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border text-xs">📍 {selectedEvent.venue_address}, {selectedEvent.city} • 🗓 {selectedEvent.start_date} s/d {selectedEvent.end_date}</div>
       <div className="mt-6">
        <div className="font-black text-sm">Rating • {selectedEvent.avg_rating.toFixed(1)} ({selectedEvent.rating_count})</div>
        <div className="flex gap-1 mt-2">{[1,2,3,4,5,6,7,8,9,10].map(n=><button key={n} onClick={()=>handleRate(selectedEvent.id,n)} className={`w-8 h-8 rounded-full border text-xs font-bold ${myRatings[selectedEvent.id]===n?'bg-black text-white':''}`}>{n}</button>)}</div>
       </div>
       <div className="mt-6">
        <div className="font-black text-sm">Komentar</div>
        <div className="mt-3 space-y-3">
         {reviews.filter(r=>r.event_id===selectedEvent.id && r.comment).map(r=>{
          const u = registeredUsers.find(u=>u.id===r.user_id);
          return <div key={r.id} className="flex gap-2"><div className="w-8 h-8 rounded-full bg-[#eee] overflow-hidden shrink-0">{u?.avatar_url?<img src={u.avatar_url} className="w-full h-full object-cover"/>:<div className="w-full h-full bg-[#E53935] text-white flex items-center justify-center text- font-black">{(u?.display_name||"U").slice(0,2)}</div>}</div><div className="flex-1 p-2.5 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border"><div className="text-xs font-bold">{u?.display_name||"User"} • ⭐ {r.rating}</div><div className="text-xs mt-1">{r.comment}</div></div></div>
         })}
        </div>
        <div className="mt-3 flex gap-2"><input value={commentText} onChange={e=>setCommentText(e.target.value)} placeholder="Tulis komentar..." className="flex-1 h-10 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm"/><button onClick={handleAddComment} className="h-10 px-5 rounded-full bg-black text-white font-bold text-sm">Kirim</button></div>
       </div>
       <div className="mt-6">
        <div className="font-black text-sm">Dokumentasi • max 10MB</div>
        <div className="mt-3 p-3 rounded-xl border-2 border-dashed grid gap-2"><input type="file" accept="image/*" onChange={e=>setDocFile(e.target.files?.[0]||null)} className="text-xs"/><input value={docCaption} onChange={e=>setDocCaption(e.target.value)} placeholder="Caption" className="h-9 rounded-xl border px-3 text-xs"/><button onClick={handleAddDoc} className="h-9 rounded-full bg-black text-white text-xs font-bold">Upload</button></div>
        <div className="mt-3 grid grid-cols-3 gap-2">{docs.filter(d=>d.event_id===selectedEvent.id).map(d=>(<div key={d.id} className="rounded-xl overflow-hidden border"><img src={d.image_url} className="w-full aspect-square object-cover"/><div className="p-1.5 text- truncate">{d.username}: {d.caption}</div></div>))}</div>
       </div>
       <div className="mt-6 flex gap-2">
        <button onClick={()=>toggleSave(selectedEvent.id)} className={`flex-1 h-11 rounded-full border font-bold text-sm ${savedIds.includes(selectedEvent.id)?'bg-[#FFD600]':''}`}>{savedIds.includes(selectedEvent.id)?'★ Tersimpan':'☆ Simpan'}</button>
        <a href={`https://wa.me/6281381067774?text=Halo%20Makicos,%20saya%20ingin%20promosikan%20event%20${encodeURIComponent(selectedEvent.title)}`} target="_blank" className="flex-1 h-11 rounded-full bg-[#25D366] text-white flex items-center justify-center font-bold text-sm">WA Promosi</a>
       </div>
      </div>
     </div>
    </div>
   )}

   {showLoginUser && <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/60" onClick={()=>setShowLoginUser(false)}></div><div className="relative w-full max-w- rounded- bg-white dark:bg-[#1A1A1A] border p-6"><div className="font-black text-lg">Masuk User</div><div className="mt-5 grid gap-3"><input id="login-user-u" placeholder="Username" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><input id="login-user-p" type="password" placeholder="Password" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /></div><button onClick={handleLoginUser} className="mt-5 w-full h-11 rounded-full bg-black text-white font-bold text-sm">Masuk</button></div></div>}
   {showRegUser && <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/60" onClick={()=>setShowRegUser(false)}></div><div className="relative w-full max-w- rounded- bg-white dark:bg-[#1A1A1A] border p-6"><div className="font-black text-lg">Daftar User</div><div className="mt-5 grid gap-3"><input id="reg-user-u" placeholder="Username huruf kecil" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><input id="reg-user-d" placeholder="Display name" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><input id="reg-user-p" type="password" placeholder="Password min 8 huruf+angka" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /></div><button onClick={handleRegUser} className="mt-5 w-full h-11 rounded-full bg-black text-white font-bold text-sm">Daftar</button></div></div>}
   {showAdmin && currentRole!=="admin" && <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/60" onClick={()=>setShowAdmin(false)}></div><div className="relative w-full max-w- rounded- bg-white dark:bg-[#1A1A1A] border p-6"><div className="font-black text-lg">Admin</div><div className="mt-5 grid gap-3"><input id="admin-user" placeholder="Username Admin" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><input id="admin-pin" type="password" placeholder="PIN" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /></div><button onClick={handleLoginAdmin} className="mt-5 w-full h-11 rounded-full bg-black text-white font-bold text-sm">Masuk Admin</button></div></div>}

   {/* EDIT PROFIL CLEAN PRODUCT */}
   {showUserProfile && (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
     <div className="absolute inset-0 bg-black/60" onClick={()=>setShowUserProfile(false)}></div>
     <div className="relative w-full max-w- rounded- bg-white dark:bg-[#1A1A1A] border p-6 max-h- overflow-auto">
      <div className="flex items-center justify-between"><div className="font-black text-lg">Edit Profil</div><button onClick={()=>setShowUserProfile(false)} className="w-8 h-8 rounded-full bg-[#F3F3F3] dark:bg-[#2A2A2A]">✕</button></div>
      <div className="mt-6 flex items-center gap-4">
       <div className="w-16 h-16 rounded-full overflow-hidden bg-[#F3F3F3] border shrink-0">{registeredUsers.find(u=>u.id===currentUserId)?.avatar_url?<img src={registeredUsers.find(u=>u.id===currentUserId)?.avatar_url} className="w-full h-full object-cover"/>:<div className="w-full h-full bg-[#E53935] text-white flex items-center justify-center font-black">{currentUser.slice(0,2).toUpperCase()}</div>}</div>
       <div>
        <input type="file" accept="image/*" id="avatar-input" className="hidden" onChange={e=>{
         const f=e.target.files?.[0]; if(!f) return;
         if(f.size>3*1024*1024){ setToast("Max 3MB"); return; }
         setAvatarToCrop(URL.createObjectURL(f)); setAvatarZoom(1); setAvatarPos({x:0,y:0}); setShowAvatarCrop(true); setUserAvatarFile(f);
        }}/>
        <button onClick={()=>document.getElementById('avatar-input')?.click()} className="h-9 px-4 rounded-full border text-xs font-bold">Ganti Foto</button>
       </div>
      </div>
      <div className="mt-5 space-y-3">
       <input id="edit-user-display" defaultValue={currentUser} placeholder="Nama tampilan" className="w-full h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm"/>
       <textarea id="edit-user-bio" defaultValue={registeredUsers.find(u=>u.id===currentUserId)?.bio||""} placeholder="Bio" className="w-full min-h- rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border p-3 text-sm"/>
      </div>
      <button onClick={handleUpdateUserProfile} className="mt-5 w-full h-11 rounded-full bg-black text-white font-bold text-sm">Simpan</button>
      <div className="mt-8 border-t pt-6">
       <div className="font-bold text-sm">Ganti Password</div>
       <div className="mt-3 grid gap-3">
        <input id="edit-user-oldpass" type="password" placeholder="Password lama" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm"/>
        <input id="edit-user-newpass" type="password" placeholder="Baru min 8 huruf+angka" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm"/>
        <button onClick={handleChangeUserPassword} className="h-11 rounded-full border font-bold text-sm">Ganti Password</button>
       </div>
      </div>
     </div>
    </div>
   )}

   {/* AVATAR CROP FIX LAYOUT ZOOM */}
   {showAvatarCrop && (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
     <div className="absolute inset-0 bg-black/70" onClick={()=>setShowAvatarCrop(false)}></div>
     <div className="relative w-full max-w- rounded- bg-white dark:bg-[#1A1A1A] border p-6">
      <div className="font-black">Atur Foto</div>
      <div className="mt-4 w- h- mx-auto rounded-full overflow-hidden border-2 bg-[#eee] relative touch-none select-none"
       onMouseDown={e=>{ isDragging.current=true; lastPos.current={x:e.clientX,y:e.clientY}; }}
       onMouseMove={e=>{ if(!isDragging.current) return; const dx=e.clientX-lastPos.current.x; const dy=e.clientY-lastPos.current.y; setAvatarPos(p=>({x:p.x+dx,y:p.y+dy})); lastPos.current={x:e.clientX,y:e.clientY}; }}
       onMouseUp={()=>isDragging.current=false}
       onMouseLeave={()=>isDragging.current=false}
      >
       <img ref={avatarImgRef} src={avatarToCrop} draggable={false} className="absolute top-1/2 left-1/2 w-full h-auto max-w-none" style={{ transform:`translate(-50%, -50%) translate(${avatarPos.x}px, ${avatarPos.y}px) scale(${avatarZoom})` }}/>
      </div>
      <div className="mt-4 flex items-center gap-3"><span className="text-xs">Zoom</span><input type="range" min={1} max={2} step={0.1} value={avatarZoom} onChange={e=>setAvatarZoom(Number(e.target.value))} className="flex-1"/></div>
      <div className="mt-5 grid grid-cols-2 gap-2"><button onClick={()=>setShowAvatarCrop(false)} className="h-11 rounded-full border font-bold text-sm">Batal</button><button onClick={()=>{ setShowAvatarCrop(false); setToast("Foto siap, klik Simpan"); }} className="h-11 rounded-full bg-black text-white font-bold text-sm">Pakai Foto</button></div>
     </div>
    </div>
   )}

   {eventFormOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/60" onClick={()=>setEventFormOpen(false)}></div><div className="relative w-full max-w- rounded- bg-white dark:bg-[#1A1A1A] border p-6 max-h- overflow-auto"><div className="flex items-center justify-between"><div className="font-black text-lg">{editingEvent?"Edit Event":"Upload Event Baru"}</div><button onClick={()=>setEventFormOpen(false)} className="w-8 h-8 rounded-full bg-[#F3F3F3]">✕</button></div><div className="mt-5 grid gap-4"><input id="new-title" defaultValue={editingEvent?.title||""} placeholder="Nama event" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><textarea id="new-desc" defaultValue={editingEvent?.description||""} placeholder="Deskripsi min 20 karakter" className="min-h- rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border p-3 text-sm" /><div className="p-4 rounded- border-2 border-dashed"><div className="text-xs font-bold">Poster 3:4 max 3MB</div><input type="file" accept="image/*" onChange={e=>{ const f=e.target.files?.[0]; if(f) handlePosterUpload(f, setPosterPreview); }} className="mt-2 w-full text-xs" />{posterPreview&&<img src={posterPreview} className="mt-3 w-full h-48 object-cover rounded-xl border" />}{posterError&&<div className="mt-2 text- text-[#E53935] bg-[#E53935]/10 p-2 rounded-xl border">{posterError}</div>}</div><div className="p-4 rounded- bg-[#F7F7F8] dark:bg-[#2A2A2A] border"><div className="text-xs font-bold mb-2">Kategori</div><div className="grid grid-cols-2 gap-2">{eventCategoryOptions.map(cat=>{ const checked=newCategories.includes(cat); return (<label key={cat} className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer ${checked?"bg-black text-white":"bg-white"}`}><input type="checkbox" checked={checked} onChange={e=>{ if(e.target.checked) setNewCategories(prev=>[...prev,cat]); else setNewCategories(prev=>prev.filter(c=>c!==cat)); }} className="w-4 h-4" /><span className="text-xs font-bold">{cat}</span></label>)})}</div></div><div className="grid grid-cols-2 gap-2"><select value={newTicketType} onChange={e=>setNewTicketType(e.target.value as TicketType)} className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm"><option>Gratis</option><option>Berbayar</option></select><select id="new-prov" defaultValue={editingEvent?.province||"Banten"} className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm">{ALL_PROVINCES.map(p=><option key={p}>{p}</option>)}</select></div><div className="grid grid-cols-2 gap-2"><input id="new-city" defaultValue={editingEvent?.city||""} placeholder="Kota" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><input id="new-venue" defaultValue={editingEvent?.venue_address||""} placeholder="Alamat" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /></div>{newTicketType==="Berbayar"&&<input id="new-ticket-url" defaultValue={editingEvent?.ticket_url||""} placeholder="Link tiket wajib jika berbayar" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />}<input id="new-lomba-url" defaultValue={editingEvent?.registration_url||""} placeholder="Link lomba opsional" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><div className="grid grid-cols-2 gap-2"><input id="new-start" defaultValue={editingEvent?.start_date||""} type="date" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><input id="new-end" defaultValue={editingEvent?.end_date||""} type="date" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /></div><div className="grid grid-cols-2 gap-2"><input id="new-start-time" defaultValue={editingEvent?.start_time||"09:00"} type="time" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm"/><input id="new-end-time" defaultValue={editingEvent?.end_time||"18:00"} type="time" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm"/></div></div><button onClick={handleCreateEvent} className="mt-5 w-full h-12 rounded-full bg-black text-white font-bold text-sm">{editingEvent?"Simpan Perubahan":"Upload Event"}</button></div></div>}

   {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-5 py-2.5 rounded-full text-sm z-[90] shadow-xl border border-white/10 max-w- text-center">{toast}</div>}
   <footer className="border-t mt-12 py-8"><div className="max-w- mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3"><div className="flex items-center gap-3"><img src="/logo.png" className="w-8 h-8 rounded-xl object-contain" /><div><div className="font-black text-sm">NGIPEN</div><div className="text- opacity-60">Satu Hobby Satu Keseruan • {approvedEvents.length} event • {registeredUsers.length} user</div></div></div><div className="flex items-center gap-3"><a href="https://wa.me/6281381067774" target="_blank" className="text- font-bold underline">WA Promosikan Event</a><div className="text- opacity-50">© 2026 Makicos ID</div></div></div></footer>
  </div>
 );
}
