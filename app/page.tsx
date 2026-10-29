"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";

type TicketType = "Gratis" | "Berbayar";
type Category = "Cosplay" | "Idol" | "Toys Event" | "Market Event";
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
 const [showAvatarCrop,setShowAvatarCrop]=useState(false);
 const [avatarToCrop,setAvatarToCrop]=useState("");
 const [avatarZoom,setAvatarZoom]=useState(1);
 const [avatarPos,setAvatarPos]=useState({x:0,y:0});
 const avatarImgRef = useRef<HTMLImageElement>(null);

 useEffect(()=>{
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
     const { data: savesData } = await supabase.from('saves').select('event_id').eq('user_id', savedUserId);
     if(savesData) setSavedIds(savesData.map((s:any)=>s.event_id));
     const { data: ratingsData } = await supabase.from('ratings').select('*').eq('user_id', savedUserId);
     if(ratingsData){ const map: Record<string, number> = {}; (ratingsData as any).forEach((r:any)=> map[r.event_id]=r.rating ); setMyRatings(map); }
    }
    const { data: allReviews } = await supabase.from('ratings').select('*').order('created_at',{ascending:false});
    if(allReviews) setReviews(allReviews as any);
    const { data: allDocs } = await supabase.from('documentations').select('*').order('created_at',{ascending:false});
    if(allDocs) setDocs(allDocs as any);
   }catch(e){ console.log(e); }finally{ setLoading(false); }
  }
  fetchAll();
 },[]);

 useEffect(()=>{ if(toast){ const t=setTimeout(()=>setToast(""),3000); return ()=>clearTimeout(t);} },[toast]);

 const approvedEvents = useMemo(()=> events.filter(e=>e.moderation_status==='Approved'),[events]);
 const sponsoredEvents = useMemo(()=> approvedEvents.filter(e=>e.is_sponsored).sort((a,b)=>b.sponsored_priority-a.sponsored_priority),[approvedEvents]);

 const filteredEvents = useMemo(()=>{
  // FIX: user lihat semua approved, bukan cuma event dia
  let list: Event[] = currentRole==='admin' ? events : approvedEvents;
  if(search) list = list.filter(e=> e.title.toLowerCase().includes(search.toLowerCase()) || e.city.toLowerCase().includes(search.toLowerCase()) );
  if(selectedProv!=="Semua") list = list.filter(e=>e.province===selectedProv);
  if(selectedCity!=="Semua") list = list.filter(e=>e.city.toLowerCase().includes(selectedCity.toLowerCase()));
  if(selectedCat!=="Semua") list = list.filter(e=>e.categories.includes(selectedCat));
  if(selectedTicket!=="Semua") list = list.filter(e=>e.ticket_type===selectedTicket);
  if(userTab==="Tersimpan" && currentRole==="user") list = list.filter(e=>savedIds.includes(e.id));
  if(sortMode==="Terpopuler") list = [...list].sort((a,b)=> (b.views+b.saves_count) - (a.views+a.saves_count));
  else list = [...list].sort((a,b)=> new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return list;
 },[events,approvedEvents,search,selectedProv,selectedCity,selectedCat,selectedTicket,sortMode,userTab,currentRole,savedIds]);

 function getUserById(id:string){ return registeredUsers.find(u=>u.id===id); }

 async function uploadToBucket(file:File, bucket:string){
  const ext = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(fileName, file, { upsert:true });
  if(error){
   if(bucket==='avatars'){
    const { error: err2 } = await supabase.storage.from('posters').upload(fileName, file, { upsert:true });
    if(!err2){ const { data } = supabase.storage.from('posters').getPublicUrl(fileName); return data.publicUrl; }
   }
   throw error;
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
 }

 function handlePosterUpload(f:File, setter:(v:string)=>void){
  setPosterError("");
  if(f.size>3*1024*1024){ setPosterError("Maksimal 3MB"); return; }
  setPosterFile(f); setter(URL.createObjectURL(f));
 }
 function logout(){
  localStorage.removeItem('ngipen_role'); localStorage.removeItem('ngipen_user'); localStorage.removeItem('ngipen_user_id');
  setCurrentRole('guest'); setCurrentUser(""); setCurrentUserId(""); setSavedIds([]); setMyRatings({}); setShowUserProfile(false); setToast("Logout berhasil");
 }
 async function handleLoginUser(){
  const u = (document.getElementById('login-user') as HTMLInputElement)?.value?.trim();
  const p = (document.getElementById('login-pass') as HTMLInputElement)?.value?.trim();
  const { data } = await supabase.from('users').select('*').eq('username', u).maybeSingle();
  if(!data||data.password_hash!==p){ setToast("Salah"); return; }
  localStorage.setItem('ngipen_role','user'); localStorage.setItem('ngipen_user', data.display_name); localStorage.setItem('ngipen_user_id', data.id);
  setCurrentRole('user'); setCurrentUser(data.display_name); setCurrentUserId(data.id);
  const { data: savesData } = await supabase.from('saves').select('event_id').eq('user_id', data.id);
  if(savesData) setSavedIds(savesData.map((s:any)=>s.event_id));
  setShowLoginUser(false); setToast(`Halo ${data.display_name}`);
 }
 async function handleRegUser(){
  const username = (document.getElementById('reg-user') as HTMLInputElement)?.value?.trim().toLowerCase();
  const display = (document.getElementById('reg-display') as HTMLInputElement)?.value?.trim();
  const pass = (document.getElementById('reg-pass') as HTMLInputElement)?.value?.trim();
  const { data: exist } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
  if(exist){ setToast("Username dipakai"); return; }
  const { data } = await supabase.from('users').insert([{ username, display_name: display, password_hash: pass, bio:"", avatar_url:"" }]).select().single();
  if(data) setRegisteredUsers(prev=>[data as any, ...prev]);
  setShowRegUser(false); setShowLoginUser(true); setToast("Daftar berhasil");
 }
 async function handleUpdateUserProfile(){
  const display = (document.getElementById('edit-display') as HTMLInputElement)?.value?.trim();
  const bio = (document.getElementById('edit-bio') as HTMLTextAreaElement)?.value?.trim() || "";
  let avatarUrl = getUserById(currentUserId)?.avatar_url || "";
  if(userAvatarFile){ avatarUrl = await uploadToBucket(userAvatarFile, 'avatars'); }
  await supabase.from('users').update({ display_name: display, bio, avatar_url: avatarUrl }).eq('id', currentUserId);
  // FIX BIO TETAP SETELAH REFRESH
  setRegisteredUsers(prev=> prev.map(u=> u.id===currentUserId ? { ...u, display_name: display||"", bio, avatar_url: avatarUrl } : u ));
  setCurrentUser(display||""); localStorage.setItem('ngipen_user', display||"");
  setToast("Profil disimpan"); setShowUserProfile(false); setUserAvatarFile(null);
 }
 async function handleCreateEvent(){
  const title = (document.getElementById('new-title') as HTMLInputElement)?.value?.trim();
  const desc = (document.getElementById('new-desc') as HTMLTextAreaElement)?.value?.trim();
  const prov = (document.getElementById('new-prov') as HTMLSelectElement)?.value;
  const city = (document.getElementById('new-city') as HTMLInputElement)?.value?.trim();
  const venue = (document.getElementById('new-venue') as HTMLInputElement)?.value?.trim();
  const startD = (document.getElementById('new-start') as HTMLInputElement)?.value;
  const endD = (document.getElementById('new-end') as HTMLInputElement)?.value;
  const startT = (document.getElementById('new-start-time') as HTMLInputElement)?.value || "09:00";
  const endT = (document.getElementById('new-end-time') as HTMLInputElement)?.value || "18:00";
  if(!title||!desc||desc.length<20) return setToast("Deskripsi min 20");
  let posterUrl = editingEvent?.poster_url || "";
  if(posterFile) posterUrl = await uploadToBucket(posterFile, 'posters');
  const payload:any = { title, slug: slugify(title), description: desc, poster_url: posterUrl, categories: newCategories, province: prov, city, venue_address: venue, start_date: startD, end_date: endD, start_time: startT, end_time: endT, ticket_type: newTicketType, moderation_status: "Pending", organizer_id: currentUserId, organizer_name: currentUser, is_sponsored:false, views:0, saves_count:0, avg_rating:0, rating_count:0 };
  const { data } = editingEvent ? await supabase.from('events').update(payload).eq('id', editingEvent.id).select().single() : await supabase.from('events').insert([payload]).select().single();
  if(data){ if(editingEvent) setEvents(prev=>prev.map(e=>e.id===editingEvent.id?data as any:e)); else setEvents(prev=>[data as any, ...prev]); }
  setEventFormOpen(false); setEditingEvent(null); setPosterFile(null); setPosterPreview(""); setToast("Menunggu review admin");
 }
 async function handleRating(eventId:string, rating:number){
  if(currentRole!=='user') return setToast("Login dulu");
  const { data: exist } = await supabase.from('ratings').select('*').eq('event_id', eventId).eq('user_id', currentUserId).maybeSingle();
  if(exist) await supabase.from('ratings').update({ rating }).eq('id', exist.id); else await supabase.from('ratings').insert([{ event_id: eventId, user_id: currentUserId, rating }]);
  setMyRatings(prev=> ({...prev, [eventId]: rating}));
 }
 async function toggleSave(eventId:string){
  if(currentRole!=='user') return setToast("Login dulu");
  if(savedIds.includes(eventId)){ await supabase.from('saves').delete().eq('user_id', currentUserId).eq('event_id', eventId); setSavedIds(prev=>prev.filter(id=>id!==eventId)); }else{ await supabase.from('saves').insert([{ user_id: currentUserId, event_id: eventId }]); setSavedIds(prev=>[...prev, eventId]); }
 }
 async function handleComment(){
  if(!selectedEvent) return;
  const { data } = await supabase.from('ratings').insert([{ event_id: selectedEvent.id, user_id: currentUserId, rating: myRatings[selectedEvent.id]||5, comment: commentText }]).select().single();
  if(data) setReviews(prev=>[data as any, ...prev]); setCommentText("");
 }

 return (
  <div className="min-h-screen bg-[#FCFCFC]">
   <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&display=swap');*{font-family:'Plus Jakarta Sans',sans-serif}`}</style>
   <header className="sticky top-0 z-30 bg-white border-b"><div className="max-w- mx-auto px-4 h- flex items-center justify-between"><div className="flex items-center gap-2 cursor-pointer" onClick={()=>{ const c=logoClicks+1; setLogoClicks(c); if(c>=5){ setShowAdmin(true); setLogoClicks(0);} }}><img src="/logo.png" className="w-9 h-9 rounded-xl"/><div className="font-black">NGIPEN</div></div><div className="flex gap-2">{currentRole==='user'?<><button onClick={()=>setEventFormOpen(true)} className="h-9 px-4 rounded-full bg-black text-white text-xs font-bold">+ Upload</button><button onClick={()=>setShowUserProfile(true)} className="w-9 h-9 rounded-full overflow-hidden border">{getUserById(currentUserId)?.avatar_url?<img src={getUserById(currentUserId)?.avatar_url} className="w-full h-full object-cover"/>:<div className="w-full h-full bg-red-500 text-white flex items-center justify-center text-xs font-black">{currentUser.slice(0,2).toUpperCase()}</div>}</button></>:<><button onClick={()=>setShowLoginUser(true)} className="h-9 px-4 rounded-full border text-xs font-bold">Login</button><button onClick={()=>setShowRegUser(true)} className="h-9 px-4 rounded-full bg-[#E53935] text-white text-xs font-bold">Daftar</button></>}</div></div></header>

   <main className="max-w- mx-auto px-4 py-6">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
     {filteredEvents.map(ev=>(
      <div key={ev.id} onClick={()=>setSelectedEvent(ev)} className="rounded- bg-white border overflow-hidden cursor-pointer">
       <div className="aspect-[3/4] relative bg-[#F3F3F3] overflow-hidden"><img src={ev.poster_url} className="w-full h-full object-cover"/><div className="absolute bottom-2 left-2 bg-black/70 text-white text- px-2 py-1 rounded-full">{getTimeStatus(ev)}</div></div>
       <div className="p-3"><div className="font-bold text-sm line-clamp-2">{ev.title}</div><div className="text- opacity-60">{ev.city}</div></div>
      </div>
     ))}
    </div>
   </main>

   {/* DETAIL - FIX POSTER ZOOM */}
   {selectedEvent && (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-0 md:p-4">
     <div className="absolute inset-0 bg-black/60" onClick={()=>setSelectedEvent(null)}></div>
     <div className="relative w-full max-w- bg-white md:rounded- max-h- overflow-auto">
      {/* FIX: poster max-h 46vh object-contain biar deskripsi keliatan */}
      <div className="relative w-full max-h- bg-[#F3F3F3] flex items-center justify-center overflow-hidden shrink-0">
       <img src={selectedEvent.poster_url} alt={selectedEvent.title} className="w-auto h-auto max-w-full max-h- object-contain mx-auto block"/>
       <button onClick={()=>setSelectedEvent(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/70 text-white">✕</button>
       <div className="absolute bottom-3 left-3 bg-black/70 text-white text-xs px-3 py-1 rounded-full">{getTimeStatus(selectedEvent)}</div>
      </div>
      <div className="p-5">
       <div className="font-black text-lg">{selectedEvent.title}</div>
       <div className="text-sm mt-2 opacity-80 whitespace-pre-wrap">{selectedEvent.description}</div>
       <div className="mt-4 text-xs p-3 rounded-xl bg-[#F7F7F8] border">📍 {selectedEvent.city}, {selectedEvent.province} • {selectedEvent.start_date} {selectedEvent.start_time}-{selectedEvent.end_time}</div>
       <div className="mt-6 font-black text-sm">Rating & Komentar</div>
       <div className="mt-2 space-y-2">
        {reviews.filter(r=>r.event_id===selectedEvent.id&&r.comment).map(r=>{ const u=getUserById(r.user_id); return (
         <div key={r.id} className="flex gap-2">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[#eee] shrink-0">{u?.avatar_url?<img src={u.avatar_url} className="w-full h-full object-cover"/>:<div className="w-full h-full bg-red-500 text-white flex items-center justify-center text-">{(u?.display_name||"U").slice(0,2)}</div>}</div>
          <div className="flex-1 p-2.5 rounded-xl bg-[#F7F7F8] border"><div className="text-xs font-bold">{u?.display_name} • ★{r.rating}</div><div className="text-xs">{r.comment}</div></div>
         </div>
        )})}
       </div>
       <div className="mt-4 flex gap-2"><input value={commentText} onChange={e=>setCommentText(e.target.value)} placeholder="Tulis komentar..." className="flex-1 h-10 rounded-full border px-4 text-sm"/><button onClick={handleComment} className="h-10 px-5 rounded-full bg-black text-white text-sm">Kirim</button></div>
       <div className="mt-6 flex gap-2"><button onClick={()=>toggleSave(selectedEvent.id)} className="flex-1 h-11 rounded-full border font-bold text-sm">{savedIds.includes(selectedEvent.id)?'★ Tersimpan':'☆ Simpan'}</button><a href="https://wa.me/6281381067774" target="_blank" className="flex-1 h-11 rounded-full bg-[#25D366] text-white flex items-center justify-center font-bold text-sm">WA Promosi</a></div>
      </div>
     </div>
    </div>
   )}

   {showLoginUser && <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/60" onClick={()=>setShowLoginUser(false)}></div><div className="relative w-full max-w- rounded- bg-white border p-6"><div className="font-black">Login</div><input id="login-user" placeholder="Username" className="mt-5 w-full h-11 rounded-xl border px-4 text-sm"/><input id="login-pass" type="password" placeholder="Password" className="mt-3 w-full h-11 rounded-xl border px-4 text-sm"/><button onClick={handleLoginUser} className="mt-5 w-full h-11 rounded-full bg-black text-white font-bold">Masuk</button></div></div>}
   {showRegUser && <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/60" onClick={()=>setShowRegUser(false)}></div><div className="relative w-full max-w- rounded- bg-white border p-6"><div className="font-black">Daftar</div><input id="reg-user" placeholder="Username" className="mt-5 w-full h-11 rounded-xl border px-4 text-sm"/><input id="reg-display" placeholder="Nama tampilan" className="mt-3 w-full h-11 rounded-xl border px-4 text-sm"/><input id="reg-pass" type="password" placeholder="Password" className="mt-3 w-full h-11 rounded-xl border px-4 text-sm"/><button onClick={handleRegUser} className="mt-5 w-full h-11 rounded-full bg-black text-white font-bold">Daftar</button></div></div>}

   {/* EDIT PROFIL CLEAN PRODUCT - NO TEKNIS */}
   {showUserProfile && (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
     <div className="absolute inset-0 bg-black/60" onClick={()=>setShowUserProfile(false)}></div>
     <div className="relative w-full max-w- rounded- bg-white border p-6 max-h- overflow-auto">
      <div className="flex items-center justify-between"><div className="font-black text-lg">Edit Profil</div><button onClick={()=>setShowUserProfile(false)} className="w-8 h-8 rounded-full bg-[#F3F3F3]">✕</button></div>
      <div className="mt-6 flex items-center gap-4">
       <div className="w-16 h-16 rounded-full overflow-hidden bg-[#F3F3F3] border">{getUserById(currentUserId)?.avatar_url?<img src={getUserById(currentUserId)?.avatar_url} className="w-full h-full object-cover"/>:<div className="w-full h-full bg-[#E53935] text-white flex items-center justify-center font-black">{currentUser.slice(0,2).toUpperCase()}</div>}</div>
       <div><input type="file" accept="image/*" id="avatar-input" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; if(f.size>3*1024*1024){ setToast("Max 3MB"); return; } setAvatarToCrop(URL.createObjectURL(f)); setAvatarZoom(1); setAvatarPos({x:0,y:0}); setShowAvatarCrop(true); setUserAvatarFile(f); }}/><button onClick={()=>document.getElementById('avatar-input')?.click()} className="h-9 px-4 rounded-full border text-xs font-bold">Ganti Foto</button></div>
      </div>
      <input id="edit-display" defaultValue={getUserById(currentUserId)?.display_name||currentUser} placeholder="Nama tampilan" className="mt-5 w-full h-11 rounded-xl bg-[#F7F7F8] border px-4 text-sm"/>
      <textarea id="edit-bio" defaultValue={getUserById(currentUserId)?.bio||""} placeholder="Bio" className="mt-3 w-full min-h- rounded-xl bg-[#F7F7F8] border p-3 text-sm"/>
      <button onClick={handleUpdateUserProfile} className="mt-5 w-full h-11 rounded-full bg-black text-white font-bold text-sm">Simpan</button>
      <button onClick={logout} className="mt-2 w-full h-11 rounded-full border font-bold text-sm">Logout</button>
     </div>
    </div>
   )}

   {/* CROP MODAL FIX LAYOUT ZOOM - 280px fixed */}
   {showAvatarCrop && (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
     <div className="absolute inset-0 bg-black/70" onClick={()=>setShowAvatarCrop(false)}></div>
     <div className="relative w-full max-w- rounded- bg-white border p-6">
      <div className="font-black">Atur Foto</div>
      <div className="mt-4 w- h- mx-auto rounded-full overflow-hidden border-2 bg-[#eee] relative">
       <img ref={avatarImgRef} src={avatarToCrop} className="absolute top-1/2 left-1/2 w-full h-auto select-none" style={{ transform:`translate(-50%, -50%) translate(${avatarPos.x}px, ${avatarPos.y}px) scale(${avatarZoom})` }}/>
      </div>
      <div className="mt-4 flex items-center gap-3"><span className="text-xs">Zoom</span><input type="range" min={1} max={2} step={0.1} value={avatarZoom} onChange={e=>setAvatarZoom(Number(e.target.value))} className="flex-1"/></div>
      <div className="mt-5 grid grid-cols-2 gap-2"><button onClick={()=>setShowAvatarCrop(false)} className="h-11 rounded-full border text-sm font-bold">Batal</button><button onClick={()=>{ setShowAvatarCrop(false); setToast("Foto siap, klik Simpan"); }} className="h-11 rounded-full bg-black text-white text-sm font-bold">Pakai Foto</button></div>
     </div>
    </div>
   )}

   {eventFormOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/60" onClick={()=>setEventFormOpen(false)}></div><div className="relative w-full max-w- rounded- bg-white border p-6 max-h- overflow-auto"><div className="font-black">Upload Event Baru</div><input id="new-title" placeholder="Nama event" className="mt-5 w-full h-11 rounded-xl border px-4 text-sm"/><textarea id="new-desc" placeholder="Deskripsi min 20 karakter" className="mt-3 w-full min-h- rounded-xl border p-3 text-sm"/><input type="file" accept="image/*" onChange={e=>{ const f=e.target.files?.[0]; if(f) handlePosterUpload(f, setPosterPreview); }} className="mt-3 w-full text-xs"/>{posterPreview&&<img src={posterPreview} className="mt-3 w-full h-48 object-cover rounded-xl border"/>}<div className="mt-3 grid grid-cols-2 gap-2"><input id="new-city" placeholder="Kota" className="h-11 rounded-xl border px-4 text-sm"/><select id="new-prov" className="h-11 rounded-xl border px-4 text-sm">{ALL_PROVINCES.map(p=><option key={p}>{p}</option>)}</select></div><div className="mt-3 grid grid-cols-2 gap-2"><input id="new-start" type="date" className="h-11 rounded-xl border px-4 text-sm"/><input id="new-end" type="date" className="h-11 rounded-xl border px-4 text-sm"/></div><div className="mt-3 grid grid-cols-2 gap-2"><input id="new-start-time" defaultValue="09:00" type="time" className="h-11 rounded-xl border px-4 text-sm"/><input id="new-end-time" defaultValue="18:00" type="time" className="h-11 rounded-xl border px-4 text-sm"/></div><button onClick={handleCreateEvent} className="mt-5 w-full h-12 rounded-full bg-black text-white font-bold">Upload</button></div></div>}

   {showAdmin && <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/60" onClick={()=>setShowAdmin(false)}></div><div className="relative w-full max-w- rounded- bg-white border p-6 max-h- overflow-auto"><div className="font-black">Admin • {registeredUsers.length} user</div><div className="mt-4">Total {registeredUsers.length} user terdaftar</div>{registeredUsers.map(u=><div key={u.id} className="mt-2 p-2 border rounded-xl text-sm">{u.display_name} @{u.username}</div>)}</div></div>}

   {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-5 py-2.5 rounded-full text-sm z-[90]">{toast}</div>}
   <footer className="border-t mt-12 py-8 text-center text- opacity-50">© 2026 Makicos ID • <a href="https://wa.me/6281381067774" className="underline">WA Promosikan Event</a></footer>
  </div>
 );
}
