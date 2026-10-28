"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";

type TicketType = "Gratis" | "Berbayar";
type Category = "Gratis" | "Berbayar" | "Cosplay" | "Idol" | "Toys Event" | "Market Event";
type ModStatus = "Pending" | "Approved" | "Rejected" | "Hidden" | "Archived";
type TimeStatus = "Upcoming" | "Ongoing" | "Completed";
type Role = "guest" | "user" | "eo" | "admin";

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
interface Doc { id: string; eventId: string; username: string; imageUrl: string; caption: string; created_at: string; }
interface RegUser { id?: string; username: string; password: string; displayName?: string; created_at: string; bio?: string; avatar?: string; }
interface RegEO { id?: string; name: string; password: string; email: string; wa: string; pin: string; created_at: string; }
interface EOProfile { bio: string; avatar: string; instagram: string; tiktok: string; youtube: string; website: string; wa: string; email: string; }
interface Audit { id: string; action: string; eventTitle: string; by: string; time: string; }

const ALL_PROVINCES = ["Aceh","Sumatera Utara","Sumatera Barat","Riau","Jambi","Sumatera Selatan","Bengkulu","Lampung","Kepulauan Bangka Belitung","Kepulauan Riau","DKI Jakarta","Jawa Barat","Jawa Tengah","DI Yogyakarta","Jawa Timur","Banten","Bali","Nusa Tenggara Barat","Nusa Tenggara Timur","Kalimantan Barat","Kalimantan Tengah","Kalimantan Selatan","Kalimantan Timur","Kalimantan Utara","Sulawesi Utara","Sulawesi Tengah","Sulawesi Selatan","Sulawesi Tenggara","Gorontalo","Sulawesi Barat","Maluku","Maluku Utara","Papua","Papua Barat","Papua Selatan","Papua Tengah","Papua Pegunungan","Papua Barat Daya"];

const eventCategoryOptions: Category[] = ["Cosplay","Idol","Toys Event","Market Event"];

function getTimeStatus(e: Event): TimeStatus {
 const now = new Date(); const start = new Date(`${e.start_date}T${e.start_time}`); const end = new Date(`${e.end_date}T${e.end_time}`);
 if (now < start) return "Upcoming"; if (now >= start && now < end) return "Ongoing"; return "Completed";
}

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
 const [sortMode,setSortMode]=useState<"Terbaru"|"Terpopuler"|"Terdekat">("Terbaru");
 const [selectedEvent,setSelectedEvent]=useState<Event|null>(null);
 const [showLoginUser,setShowLoginUser]=useState(false);
 const [showLoginEO,setShowLoginEO]=useState(false);
 const [showAdmin,setShowAdmin]=useState(false);
 const [showRegUser,setShowRegUser]=useState(false);
 const [showRegEO,setShowRegEO]=useState(false);
 const [currentRole,setCurrentRole]=useState<Role>("guest");
 const [currentUser,setCurrentUser]=useState("");
 const [currentUserId,setCurrentUserId]=useState("");
 const [currentEOId,setCurrentEOId]=useState("");
 const [toast,setToast]=useState("");
 const [adminPin,setAdminPin]=useState("1111");
 const [logoClicks,setLogoClicks]=useState(0);
 const [registeredUsers,setRegisteredUsers]=useState<RegUser[]>([]);
 const [registeredEOs,setRegisteredEOs]=useState<RegEO[]>([]);
 const [savedIds,setSavedIds]=useState<string[]>([]);
 const [ratings,setRatings]=useState<Record<string, number>>({});
 const [docs,setDocs]=useState<Doc[]>([]);
 const [eoFormOpen,setEoFormOpen]=useState(false);
 const [editingEvent,setEditingEvent]=useState<Event|null>(null);
 const [posterPreview,setPosterPreview]=useState("");
 const [posterError,setPosterError]=useState("");
 const [posterFile,setPosterFile]=useState<File|null>(null);
 const [newCategories,setNewCategories]=useState<Category[]>(["Cosplay"]);
 const [newTicketType,setNewTicketType]=useState<TicketType>("Gratis");
 const [adminTab,setAdminTab]=useState<"moderation"|"users"|"eos"|"logs">("moderation");
 const [auditLogs,setAuditLogs]=useState<Audit[]>([]);
 const [sponsoredCount,setSponsoredCount]=useState(0);

 // Theme persist
 useEffect(()=>{
  const savedTheme = localStorage.getItem('ngipen_theme');
  if(savedTheme==='dark'){ setDark(true); document.documentElement.classList.add('dark'); }
  const role = localStorage.getItem('ngipen_role') as Role;
  const user = localStorage.getItem('ngipen_user');
  const userId = localStorage.getItem('ngipen_user_id');
  const eoId = localStorage.getItem('ngipen_eo_id');
  if(role){ setCurrentRole(role); }
  if(user){ setCurrentUser(user); }
  if(userId){ setCurrentUserId(userId); }
  if(eoId){ setCurrentEOId(eoId); }
  const savedSaves = localStorage.getItem('ngipen_saves');
  if(savedSaves){ try{ setSavedIds(JSON.parse(savedSaves)); }catch{} }
  const savedRatings = localStorage.getItem('ngipen_ratings');
  if(savedRatings){ try{ setRatings(JSON.parse(savedRatings)); }catch{} }
 },[]);

 useEffect(()=>{ localStorage.setItem('ngipen_saves', JSON.stringify(savedIds)); },[savedIds]);
 useEffect(()=>{ localStorage.setItem('ngipen_ratings', JSON.stringify(ratings)); },[ratings]);

 // Fetch from Supabase - ACROSS DEVICES
 useEffect(()=>{
  async function fetchAll(){
   setLoading(true);
   try{
    // Admin PIN from Supabase
    const { data: pinData } = await supabase.from('admin_settings').select('*').eq('setting_key','admin_pin').maybeSingle();
    if(pinData && pinData.setting_value){
     const val = pinData.setting_value;
     setAdminPin(typeof val === 'string' ? val.replace(/"/g,'') : String(val));
    } else {
     // create default
     await supabase.from('admin_settings').upsert({ setting_key:'admin_pin', setting_value:'"1111"' }, { onConflict:'setting_key' });
    }

    // Users
    const { data: usersData } = await supabase.from('users').select('*').order('created_at',{ascending:false});
    if(usersData){
     setRegisteredUsers(usersData.map((u:any)=>({ id:u.id, username:u.instagram_username, password:u.password_hash, displayName:u.display_name, created_at:u.created_at, bio:u.bio, avatar:u.avatar_url })));
    }

    // Organizers (EOs)
    const { data: eosData } = await supabase.from('organizers').select('*').order('created_at',{ascending:false});
    if(eosData){
     setRegisteredEOs(eosData.map((eo:any)=>({ id:eo.id, name:eo.name, password:eo.pin_hash?.split('|')[0] || '', email:eo.email, wa:eo.whatsapp, pin:eo.pin_hash?.split('|')[1] || eo.pin_hash || '', created_at:eo.created_at })));
    }

    // Events
    const { data: eventsData, error: eventsError } = await supabase.from('events').select('*').order('created_at',{ascending:false});
    if(eventsError){
     console.log('Events fetch error', eventsError);
     setEvents([]);
    } else if(eventsData){
     const mapped: Event[] = eventsData.map((ev:any)=>({
      id: ev.id,
      organizer_id: ev.organizer_id,
      title: ev.title,
      slug: ev.slug,
      description: ev.description,
      poster_url: ev.poster_url || 'https://images.unsplash.com/photo-1514533212735-5df27d970db0?w=600&h=800&fit=crop',
      categories: (ev.categories || []) as Category[],
      province: ev.province,
      city: ev.city,
      venue_address: ev.venue_address,
      start_date: ev.start_date,
      end_date: ev.end_date,
      start_time: ev.start_time?.slice(0,5) || '09:00',
      end_time: ev.end_time?.slice(0,5) || '18:00',
      ticket_type: ev.ticket_type as TicketType,
      ticket_url: ev.ticket_url,
      registration_url: ev.registration_url,
      moderation_status: ev.moderation_status as ModStatus,
      is_sponsored: ev.is_sponsored,
      sponsored_priority: ev.sponsored_priority || 0,
      sponsored_start: ev.sponsored_start,
      sponsored_end: ev.sponsored_end,
      views: ev.views || 0,
      saves_count: ev.saves_count || 0,
      avg_rating: Number(ev.avg_rating) || 0,
      rating_count: ev.rating_count || 0,
      organizer_name: ev.organizer_name || 'EO',
      created_at: ev.created_at,
     }));
     setEvents(mapped);
     setSponsoredCount(mapped.filter(e=>e.is_sponsored).length);
    }

    // Audit logs
    const { data: auditData } = await supabase.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(50);
    if(auditData){
     setAuditLogs(auditData.map((a:any)=>({ id:a.id, action:a.action, eventTitle:a.target_id || '-', by:a.actor_id || 'system', time:a.created_at })));
    }

   } catch(e){
    console.error('Supabase fetch error', e);
   }
   setLoading(false);
  }
  fetchAll();
 },[]);

 const toggleTheme=()=>{ 
  const newDark=!dark; setDark(newDark); 
  if(newDark){ document.documentElement.classList.add('dark'); localStorage.setItem('ngipen_theme','dark'); } 
  else { document.documentElement.classList.remove('dark'); localStorage.setItem('ngipen_theme','light'); } 
 };

 const handleLogoClick=()=>{
  const now=Date.now();
  const lastClick = Number(localStorage.getItem('ngipen_last_logo_click')||'0');
  if(now-lastClick>4000) setLogoClicks(1); else setLogoClicks(c=>c+1);
  localStorage.setItem('ngipen_last_logo_click', String(now));
  if(logoClicks+1>=5){
   setToast("Mode Admin Terbuka"); setTimeout(()=>setToast(""),2000);
   window.location.hash="#admin";
  }
 };

 useEffect(()=>{
  const checkHash=()=>{ if(window.location.hash==="#admin"){ setShowAdmin(true); } };
  checkHash();
  window.addEventListener('hashchange', checkHash);
  const handleKey=(e:KeyboardEvent)=>{ if(e.ctrlKey && e.shiftKey && e.key.toLowerCase()==='a'){ setShowAdmin(true); window.location.hash="#admin"; } };
  window.addEventListener('keydown', handleKey);
  return()=>{ window.removeEventListener('hashchange', checkHash); window.removeEventListener('keydown', handleKey); };
 },[]);

 const filteredEvents = useMemo(()=>{
  let list = [...events];
  if(selectedProv!=="Semua") list = list.filter(e=>e.province===selectedProv);
  if(selectedCity!=="Semua") list = list.filter(e=>e.city===selectedCity);
  if(selectedCat!=="Semua") list = list.filter(e=>e.categories.includes(selectedCat as Category));
  if(selectedTicket!=="Semua") list = list.filter(e=>e.ticket_type===selectedTicket);
  if(search){
   const q=search.toLowerCase();
   list = list.filter(e=>e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.city.toLowerCase().includes(q));
  }
  if(sortMode==="Terbaru") list.sort((a,b)=> new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if(sortMode==="Terpopuler") list.sort((a,b)=> b.views - a.views);
  // Sponsored first
  list.sort((a,b)=>{ if(a.is_sponsored && !b.is_sponsored) return -1; if(!a.is_sponsored && b.is_sponsored) return 1; return b.sponsored_priority - a.sponsored_priority; });
  return list;
 },[events, selectedProv, selectedCity, selectedCat, selectedTicket, search, sortMode]);

 const approvedEvents = filteredEvents.filter(e=>e.moderation_status==="Approved");
 const sponsoredEvents = approvedEvents.filter(e=>e.is_sponsored).slice(0,10);

 const handlePosterUpload=(file:File, setter:(v:string)=>void)=>{
  setPosterError("");
  if(file.size>3*1024*1024){ setPosterError("Maks 3MB"); return; }
  const img = new Image();
  img.onload=()=>{
   const ratio = img.width/img.height;
   const expected = 3/4;
   if(Math.abs(ratio-expected)>0.15){ setPosterError(`Poster harus rasio 3:4, terdeteksi ${img.width}x${img.height}`); }
   setter(URL.createObjectURL(file));
   setPosterFile(file);
  };
  img.src = URL.createObjectURL(file);
 };

 const uploadPosterToSupabase = async (file:File): Promise<string>=>{
  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g,'_')}`;
  const { data, error } = await supabase.storage.from('posters').upload(fileName, file);
  if(error){ console.error('Upload error', error); throw error; }
  const { data: publicUrl } = supabase.storage.from('posters').getPublicUrl(fileName);
  return publicUrl.publicUrl;
 };

 const handleSaveEvent=async(id:string)=>{
  if(currentRole!=="user"){ setToast("Login sebagai User dulu"); setTimeout(()=>setToast(""),2000); return; }
  if(savedIds.includes(id)){
   setSavedIds(prev=>prev.filter(i=>i!==id));
   // supabase delete
   if(currentUserId){
    await supabase.from('event_saves').delete().eq('user_id',currentUserId).eq('event_id',id);
   }
  } else {
   setSavedIds(prev=>[...prev,id]);
   if(currentUserId){
    await supabase.from('event_saves').insert({ user_id:currentUserId, event_id:id });
   }
   // increment saves_count
   const ev = events.find(e=>e.id===id);
   if(ev){
    await supabase.from('events').update({ saves_count:(ev.saves_count||0)+1 }).eq('id',id);
    setEvents(prev=>prev.map(e=>e.id===id?{...e, saves_count:(e.saves_count||0)+1}:e));
   }
  }
 };

 const handleViewEvent=async(ev:Event)=>{
  setSelectedEvent(ev);
  // increment views in DB
  const newViews = (ev.views||0)+1;
  await supabase.from('events').update({ views:newViews }).eq('id',ev.id);
  setEvents(prev=>prev.map(e=>e.id===ev.id?{...e, views:newViews}:e));
 };

 const handleDeleteEvent=async(id:string, title:string)=>{
  if(!confirm(`Hapus permanen event "${title}"?`)) return;
  const { error } = await supabase.from('events').delete().eq('id',id);
  if(error){ setToast("Gagal hapus: "+error.message); setTimeout(()=>setToast(""),2000); return; }
  setEvents(prev=>prev.filter(e=>e.id!==id));
  setSelectedEvent(null);
  await supabase.from('audit_logs').insert({ actor_id:currentUser||'admin', actor_role:currentRole, action:`Delete event ${title}`, target_type:'event', target_id:id });
  setToast("Event dihapus permanen dari database"); setTimeout(()=>setToast(""),2000);
 };

 const handleModeration=async(id:string, action:ModStatus | "Sponsor" | "UnSponsor", title:string)=>{
  let update:any = {};
  if(action==="Approved" || action==="Rejected" || action==="Hidden" || action==="Archived"){ update.moderation_status = action; }
  if(action==="Sponsor"){
   const count = events.filter(e=>e.is_sponsored).length;
   if(count>=10){ setToast("Sponsor max 10 tercapai"); setTimeout(()=>setToast(""),2000); return; }
   update.is_sponsored = true;
   update.sponsored_priority = count+1;
   update.sponsored_start = new Date().toISOString();
   update.sponsored_end = new Date(Date.now()+30*24*60*60*1000).toISOString();
  }
  if(action==="UnSponsor"){ update.is_sponsored = false; update.sponsored_priority = 0; }
  const { error } = await supabase.from('events').update(update).eq('id',id);
  if(error){ setToast("Gagal: "+error.message); setTimeout(()=>setToast(""),2000); return; }
  setEvents(prev=>prev.map(e=>e.id===id?{...e, ...update}:e));
  await supabase.from('audit_logs').insert({ actor_id:currentUser||'admin', actor_role:'admin', action:`${action} ${title}`, target_type:'event', target_id:title });
  setToast(`${action} berhasil`); setTimeout(()=>setToast(""),2000);
 };

 const handlePromosikan=(ev:Event)=>{
  const msg = `Halo NGIPEN! Saya mau promosikan event saya agar jadi *SPONSOR* di homepage carousel NGIPEN

*Judul:* ${ev.title}
*Lokasi:* ${ev.province}, ${ev.city} - ${ev.venue_address}
*Tanggal:* ${ev.start_date} s/d ${ev.end_date} ${ev.start_time}-${ev.end_time} WIB
*Tiket:* ${ev.ticket_type} ${ev.ticket_url||''}
*Kategori:* ${ev.categories.join(', ')}
*Rating:* ${ev.avg_rating} (${ev.rating_count})
*Views:* ${ev.views}

Link event: https://ngipen-makicos-1.vercel.app

Mohon info biaya dan syarat sponsor. Terima kasih!`;
  window.open(`https://wa.me/6281381067774?text=${encodeURIComponent(msg)}`,'_blank');
 };

 // REGISTER USER - SUPABASE 
 const handleRegisterUser=async()=>{
  const username = (document.getElementById('reg-user-username') as HTMLInputElement)?.value?.trim().toLowerCase();
  const displayName = (document.getElementById('reg-user-display') as HTMLInputElement)?.value?.trim();
  const password = (document.getElementById('reg-user-pass') as HTMLInputElement)?.value;
  if(!username || username.length<3){ setToast("Username min 3 huruf lowercase"); setTimeout(()=>setToast(""),2000); return; }
  if(!/^[a-z0-9_]+$/.test(username)){ setToast("Username hanya huruf kecil, angka, underscore"); setTimeout(()=>setToast(""),2000); return; }
  if(!password || password.length<8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)){ setToast("Password min 8 huruf+angka"); setTimeout(()=>setToast(""),2000); return; }
  // check duplicate in Supabase
  const { data: existing } = await supabase.from('users').select('id').eq('normalized_username',username).maybeSingle();
  if(existing){ setToast("Username sudah dipakai"); setTimeout(()=>setToast(""),2000); return; }
  const { data, error } = await supabase.from('users').insert({ instagram_username:username, normalized_username:username, password_hash:password, display_name:displayName||username }).select().single();
  if(error){ setToast("Gagal daftar: "+error.message); setTimeout(()=>setToast(""),2000); return; }
  setRegisteredUsers(prev=>[{ id:data.id, username, password, displayName, created_at:data.created_at }, ...prev]);
  setShowRegUser(false);
  setToast("User terdaftar! Silakan login."); setTimeout(()=>setToast(""),3000);
 };

 // REGISTER EO - SUPABASE 
 const handleRegisterEO=async()=>{
  const name = (document.getElementById('reg-eo-name') as HTMLInputElement)?.value?.trim();
  const email = (document.getElementById('reg-eo-email') as HTMLInputElement)?.value?.trim();
  const wa = (document.getElementById('reg-eo-wa') as HTMLInputElement)?.value?.trim();
  const password = (document.getElementById('reg-eo-pass') as HTMLInputElement)?.value;
  const pin = (document.getElementById('reg-eo-pin') as HTMLInputElement)?.value?.trim();
  const province = (document.getElementById('reg-eo-prov') as HTMLSelectElement)?.value;
  const city = (document.getElementById('reg-eo-city') as HTMLInputElement)?.value?.trim();
  if(!name || name.length<3){ setToast("Nama EO min 3"); setTimeout(()=>setToast(""),2000); return; }
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ setToast("Email tidak valid"); setTimeout(()=>setToast(""),2000); return; }
  if(!wa || wa.length<10){ setToast("WA min 10 digit"); setTimeout(()=>setToast(""),2000); return; }
  if(!pin || !/^\d{6}$/.test(pin)){ setToast("PIN harus 6 digit angka"); setTimeout(()=>setToast(""),2000); return; }
  if(!password || password.length<8){ setToast("Password min 8"); setTimeout(()=>setToast(""),2000); return; }
  const { data: existingName } = await supabase.from('organizers').select('id').eq('name',name).maybeSingle();
  if(existingName){ setToast("Nama EO sudah dipakai"); setTimeout(()=>setToast(""),2000); return; }
  const { data: existingEmail } = await supabase.from('organizers').select('id').eq('email',email).maybeSingle();
  if(existingEmail){ setToast("Email sudah dipakai"); setTimeout(()=>setToast(""),2000); return; }
  // simpan password|pin di pin_hash untuk kompatibilitas
  const { data, error } = await supabase.from('organizers').insert({ name, email, whatsapp:wa, province:province||'Banten', city:city||'Rangkasbitung', pin_hash:`${password}|${pin}`, verification_status:'verified' }).select().single();
  if(error){ setToast("Gagal daftar EO: "+error.message); setTimeout(()=>setToast(""),2000); return; }
  setRegisteredEOs(prev=>[{ id:data.id, name, password, email, wa, pin, created_at:data.created_at }, ...prev]);
  setShowRegEO(false);
  setToast("EO terdaftar! Silakan login."); setTimeout(()=>setToast(""),3000);
 };

 // LOGIN USER
 const handleLoginUser=async()=>{
  const username = (document.getElementById('login-user-username') as HTMLInputElement)?.value?.trim().toLowerCase();
  const password = (document.getElementById('login-user-pass') as HTMLInputElement)?.value;
  const { data, error } = await supabase.from('users').select('*').eq('normalized_username',username).eq('password_hash',password).maybeSingle();
  if(error || !data){ setToast("Username/password salah"); setTimeout(()=>setToast(""),2000); return; }
  setCurrentRole("user"); setCurrentUser(data.instagram_username); setCurrentUserId(data.id);
  localStorage.setItem('ngipen_role','user'); localStorage.setItem('ngipen_user',data.instagram_username); localStorage.setItem('ngipen_user_id',data.id);
  setShowLoginUser(false); setToast(`Halo ${data.display_name||data.instagram_username}`); setTimeout(()=>setToast(""),2000);
 };

 // LOGIN EO
 const handleLoginEO=async()=>{
  const name = (document.getElementById('login-eo-name') as HTMLInputElement)?.value?.trim();
  const password = (document.getElementById('login-eo-pass') as HTMLInputElement)?.value;
  const pin = (document.getElementById('login-eo-pin') as HTMLInputElement)?.value?.trim();
  const { data, error } = await supabase.from('organizers').select('*').eq('name',name).maybeSingle();
  if(error || !data){ setToast("Nama EO tidak ditemukan"); setTimeout(()=>setToast(""),2000); return; }
  const storedPass = data.pin_hash?.split('|')[0] || '';
  const storedPin = data.pin_hash?.split('|')[1] || data.pin_hash || '';
  if(storedPass!==password || storedPin!==pin){ setToast("Password/PIN salah"); setTimeout(()=>setToast(""),2000); return; }
  setCurrentRole("eo"); setCurrentUser(data.name); setCurrentEOId(data.id); setCurrentUserId("");
  localStorage.setItem('ngipen_role','eo'); localStorage.setItem('ngipen_user',data.name); localStorage.setItem('ngipen_eo_id',data.id);
  setShowLoginEO(false); setToast(`Halo EO ${data.name}`); setTimeout(()=>setToast(""),2000);
 };

 // LOGIN ADMIN
 const handleLoginAdmin=async()=>{
  const username = (document.getElementById('admin-user') as HTMLInputElement)?.value?.trim();
  const pin = (document.getElementById('admin-pin') as HTMLInputElement)?.value?.trim();
  if(username!=="makicos"){ setToast("Username admin salah"); setTimeout(()=>setToast(""),2000); return; }
  // check pin from state (synced from Supabase)
  if(pin!==adminPin){ setToast("PIN salah"); setTimeout(()=>setToast(""),2000); return; }
  setCurrentRole("admin"); setCurrentUser("makicos");
  localStorage.setItem('ngipen_role','admin'); localStorage.setItem('ngipen_user','makicos');
  setShowAdmin(false); setToast("Admin login berhasil"); setTimeout(()=>setToast(""),2000);
 };

 const handleChangeAdminPin=async()=>{
  const oldPin = (document.getElementById('old-pin') as HTMLInputElement)?.value?.trim();
  const newPin = (document.getElementById('new-pin') as HTMLInputElement)?.value?.trim();
  if(oldPin!==adminPin){ setToast("PIN lama salah"); setTimeout(()=>setToast(""),2000); return; }
  if(!newPin || !/^\d{4,6}$/.test(newPin)){ setToast("PIN baru 4-6 digit"); setTimeout(()=>setToast(""),2000); return; }
  const { error } = await supabase.from('admin_settings').upsert({ setting_key:'admin_pin', setting_value:`"${newPin}"` }, { onConflict:'setting_key' });
  if(error){ setToast("Gagal ganti PIN: "+error.message); setTimeout(()=>setToast(""),2000); return; }
  setAdminPin(newPin);
  setToast("PIN admin diganti"); setTimeout(()=>setToast(""),2000);
 };

 const handleCreateEvent=async()=>{
  const title=(document.getElementById('new-title') as HTMLInputElement)?.value?.trim() || '';
  const desc=(document.getElementById('new-desc') as HTMLTextAreaElement)?.value?.trim() || '';
  const city=(document.getElementById('new-city') as HTMLInputElement)?.value?.trim() || 'Rangkasbitung';
  const prov=(document.getElementById('new-prov') as HTMLSelectElement)?.value || 'Banten';
  const venue=(document.getElementById('new-venue') as HTMLInputElement)?.value?.trim() || 'Alun-alun';
  const start=(document.getElementById('new-start') as HTMLInputElement)?.value || '2026-12-01';
  const end=(document.getElementById('new-end') as HTMLInputElement)?.value || '2026-12-02';
  const ticketUrl=(document.getElementById('new-ticket-url') as HTMLInputElement)?.value?.trim() || null;
  const lombaUrl=(document.getElementById('new-lomba-url') as HTMLInputElement)?.value?.trim() || null;
  if(!title){ setToast("Nama event wajib"); setTimeout(()=>setToast(""),2000); return; }
  if(newCategories.length===0){ setToast("Pilih minimal 1 kategori"); setTimeout(()=>setToast(""),2000); return; }
  if(newTicketType==="Berbayar" && !ticketUrl){ setToast("Berbayar wajib link tiket"); setTimeout(()=>setToast(""),2000); return; }
  if(!posterFile && !editingEvent){ setToast("Upload poster 3:4"); setTimeout(()=>setToast(""),2000); return; }

  let posterUrl = editingEvent?.poster_url || "";
  if(posterFile){
   try{
    posterUrl = await uploadPosterToSupabase(posterFile);
   } catch(e:any){ setToast("Gagal upload poster: "+e.message); setTimeout(()=>setToast(""),2000); return; }
  }

  const finalCategories = [...newCategories, newTicketType] as string[];
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g,'-') + '-' + Date.now();

  if(editingEvent){
   const { error } = await supabase.from('events').update({
    title, description:desc, province:prov, city, venue_address:venue,
    ticket_type:newTicketType, ticket_url:ticketUrl, registration_url:lombaUrl,
    categories:finalCategories, start_date:start, end_date:end,
    poster_url:posterUrl, moderation_status:'Pending'
   }).eq('id',editingEvent.id);
   if(error){ setToast("Gagal update: "+error.message); setTimeout(()=>setToast(""),2000); return; }
   setEvents(prev=>prev.map(ev=> ev.id===editingEvent.id ? {...ev, title, description:desc, province:prov, city, venue_address:venue, ticket_type:newTicketType, ticket_url:ticketUrl||undefined, registration_url:lombaUrl||undefined, categories:finalCategories as Category[], start_date:start, end_date:end, poster_url:posterUrl, moderation_status:"Pending" as ModStatus } : ev));
   setToast('Event diperbarui, menunggu review admin'); 
  } else {
   const { data, error } = await supabase.from('events').insert({
    organizer_id: currentEOId,
    title, slug, description:desc, poster_url:posterUrl,
    categories:finalCategories, province:prov, city, venue_address:venue,
    start_date:start, end_date:end, start_time:'09:00', end_time:'18:00',
    ticket_type:newTicketType, ticket_url:ticketUrl, registration_url:lombaUrl,
    moderation_status:'Pending', is_sponsored:false, sponsored_priority:0,
    views:0, saves_count:0, avg_rating:0, rating_count:0, organizer_name:currentUser
   }).select().single();
   if(error){ setToast("Gagal buat event: "+error.message); setTimeout(()=>setToast(""),2000); return; }
   const newEv:Event = {
    id:data.id, organizer_id:data.organizer_id, title:data.title, slug:data.slug, description:data.description, poster_url:data.poster_url,
    categories:data.categories as Category[], province:data.province, city:data.city, venue_address:data.venue_address,
    start_date:data.start_date, end_date:data.end_date, start_time:'09:00', end_time:'18:00',
    ticket_type:data.ticket_type as TicketType, ticket_url:data.ticket_url, registration_url:data.registration_url,
    moderation_status:data.moderation_status as ModStatus, is_sponsored:false, sponsored_priority:0,
    views:0, saves_count:0, avg_rating:0, rating_count:0, organizer_name:currentUser, created_at:data.created_at
   };
   setEvents(prev=>[newEv,...prev]);
   setToast('Event dibuat, menunggu approval admin. Sudah sinkron ke semua device!');
  }
  setTimeout(()=>setToast(""),2000); setEoFormOpen(false); setEditingEvent(null); setPosterPreview(""); setPosterError(""); setPosterFile(null); setNewTicketType("Gratis"); setNewCategories(["Cosplay"]);
 };

 const logout=()=>{
  setCurrentRole("guest"); setCurrentUser(""); setCurrentUserId(""); setCurrentEOId("");
  localStorage.removeItem('ngipen_role'); localStorage.removeItem('ngipen_user'); localStorage.removeItem('ngipen_user_id'); localStorage.removeItem('ngipen_eo_id');
  setToast("Logout berhasil"); setTimeout(()=>setToast(""),2000);
 };

 if(loading){
  return (
   <div className="min-h-screen flex items-center justify-center bg-[#F7F7F8] dark:bg-[#121212]">
    <div className="text-center">
     <div className="w-10 h-10 border-4 border-[#E53935] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
     <div className="font-bold text-sm">NGIPEN - Sinkronisasi database...</div>
     <div className="text-xs opacity-60 mt-1">Mengambil data dari Supabase</div>
    </div>
   </div>
  );
 }

 return (
  <div className={`min-h-screen ${dark?"dark bg-[#121212] text-white":"bg-[#F7F7F8] text-[#242424]"} transition-colors`}>
   <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'); *{font-family:Inter,sans-serif} .line-clamp-2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}`}</style>

   {/* HEADER */}
   <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-[#1A1A1A]/80 border-b">
    <div className="max-w-[1280px] mx-auto px-4 h-[64px] flex items-center justify-between">
     <div className="flex items-center gap-3 cursor-pointer select-none" onClick={handleLogoClick}>
      <div className="w-9 h-9 rounded-xl bg-[#E53935] flex items-center justify-center text-white font-black text-[18px]">N</div>
      <div>
       <div className="font-black text-[18px] leading-none tracking-tight">NGIPEN</div>
       <div className="text-[10px] opacity-60 font-bold tracking-widest -mt-0.5">SATU HOBBY SATU KESERUAN</div>
      </div>
     </div>

     <div className="flex items-center gap-2">
      <button onClick={toggleTheme} className="w-11 h-11 rounded-full bg-[#F7F7F8] dark:bg-[#2A2A2A] border flex items-center justify-center text-sm">{dark?"☀️":"🌙"}</button>
      <div className="hidden md:flex items-center gap-2">
       {currentRole==="guest" ? (
        <>
         <button onClick={()=>setShowLoginUser(true)} className="h-11 px-5 rounded-full bg-white dark:bg-[#2A2A2A] border font-bold text-sm">Masuk User</button>
         <button onClick={()=>setShowLoginEO(true)} className="h-11 px-5 rounded-full bg-black text-white font-bold text-sm">Masuk EO</button>
        </>
       ):(
        <>
         <div className="px-4 h-11 rounded-full bg-[#F7F7F8] dark:bg-[#2A2A2A] border flex items-center gap-2 text-sm font-bold">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>{currentRole.toUpperCase()} : {currentUser}
          
         </div>
         {currentRole==="eo" && <button onClick={()=>{ setEditingEvent(null); setEoFormOpen(true); }} className="h-11 px-5 rounded-full bg-[#E53935] text-white font-bold text-sm">Upload</button>}
         <button onClick={logout} className="h-11 w-11 rounded-full bg-white dark:bg-[#2A2A2A] border font-bold text-sm">⎋</button>
        </>
       )}
      </div>
      <button onClick={()=>setMobileOpen(true)} className="md:hidden w-11 h-11 rounded-full bg-black text-white flex items-center justify-center">☰</button>
     </div>
    </div>
   </header>

   {/* MOBILE DRAWER */}
   {mobileOpen && (
    <div className="fixed inset-0 z-[60] flex justify-end">
     <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={()=>setMobileOpen(false)}></div>
     <div className="relative w-[300px] h-full bg-white dark:bg-[#1A1A1A] shadow-2xl p-6 flex flex-col">
      <div className="flex items-center justify-between mb-6">
       <div className="font-black">Menu</div>
       <button onClick={()=>setMobileOpen(false)} className="w-11 h-11 rounded-full bg-[#F7F7F8] dark:bg-[#2A2A2A] border flex items-center justify-center">✕</button>
      </div>
      <div className="grid gap-3">
       {currentRole==="guest" ? (
        <>
         <button onClick={()=>{ setMobileOpen(false); setShowLoginUser(true); }} className="h-12 rounded-full bg-black text-white font-bold text-sm">Masuk sebagai User</button>
         <button onClick={()=>{ setMobileOpen(false); setShowLoginEO(true); }} className="h-12 rounded-full bg-white dark:bg-[#2A2A2A] border font-bold text-sm">Masuk sebagai EO</button>
         <button onClick={()=>{ setMobileOpen(false); setShowRegUser(true); }} className="h-12 rounded-full bg-[#F7F7F8] dark:bg-[#2A2A2A] border font-bold text-sm">Daftar User</button>
         <button onClick={()=>{ setMobileOpen(false); setShowRegEO(true); }} className="h-12 rounded-full bg-[#F7F7F8] dark:bg-[#2A2A2A] border font-bold text-sm">Daftar EO</button>
        </>
       ):(
        <>
         <div className="p-4 rounded-[16px] bg-[#F7F7F8] dark:bg-[#2A2A2A] border">
          <div className="text-xs opacity-60">Login sebagai</div>
          <div className="font-bold">{currentRole.toUpperCase()} : {currentUser}</div>
          <div className="text-[10px] mt-1 px-2 py-1 rounded-full bg-green-500 text-white inline-block">● Supabase</div>
         </div>
         {currentRole==="eo" && <button onClick={()=>{ setMobileOpen(false); setEditingEvent(null); setEoFormOpen(true); }} className="h-12 rounded-full bg-[#E53935] text-white font-bold text-sm">Upload Event</button>}
         <button onClick={()=>{ logout(); setMobileOpen(false); }} className="h-12 rounded-full bg-white dark:bg-[#2A2A2A] border font-bold text-sm">Logout</button>
        </>
       )}
       <button onClick={()=>{ toggleTheme(); setMobileOpen(false); }} className="h-12 rounded-full bg-[#F7F7F8] dark:bg-[#2A2A2A] border font-bold text-sm">{dark?"☀️ Light Mode":"🌙 Dark Mode"}</button>
      </div>
      <div className="mt-auto text-[10px] opacity-50">NGIPEN • Satu Hobby Satu Keseruan</div>
     </div>
    </div>
   )}

   <div className="max-w-[1280px] mx-auto px-4 py-6">
    {/* ROLE BANNER */}
    {currentRole!=="guest" && (
     <div className={`mb-6 p-4 rounded-[16px] border flex items-center justify-between ${currentRole==="admin"?"bg-[#E53935] text-white border-[#B71C1C]":currentRole==="eo"?"bg-black text-white border-black":"bg-white dark:bg-[#1E1E1E] border"}`}>
      <div className="flex items-center gap-3">
       <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${currentRole==="admin"?"bg-white text-[#E53935]":currentRole==="eo"?"bg-[#E53935] text-white":"bg-[#F7F7F8] dark:bg-[#2A2A2A]"}`}>{currentRole==="admin"?"A":currentRole==="eo"?"EO":"U"}</div>
       <div>
        <div className="font-bold text-sm">Mode {currentRole.toUpperCase()} • {currentUser}</div>
        <div className="text-xs opacity-70">{currentRole==="admin"?"Kelola event, user, EO - data sinkron semua device":currentRole==="eo"?"Dashboard EO - upload & kelola eventmu":`Halo ${currentUser}, data tersimpan di Supabase`}</div>
       </div>
      </div>
      <button onClick={logout} className="hidden md:flex h-11 px-5 rounded-full bg-white/20 backdrop-blur border border-white/20 font-bold text-sm">Logout</button>
     </div>
    )}

    {/* ADMIN DASHBOARD - SUPABASE */}
    {currentRole==="admin" && (
     <div className="mb-8 p-5 rounded-[24px] bg-white dark:bg-[#1E1E1E] border shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
       <div className="font-black text-lg">Admin Dashboard</div>
       <div className="flex gap-2">
        {["moderation","users","eos","logs"].map(t=>(
         <button key={t} onClick={()=>setAdminTab(t as any)} className={`h-9 px-4 rounded-full text-xs font-bold border ${adminTab===t?"bg-black text-white border-black":"bg-[#F7F7F8] dark:bg-[#2A2A2A]"}`}>{t.toUpperCase()}</button>
        ))}
       </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
       {[
        {label:"Total User", value:registeredUsers.length},
        {label:"Total EO", value:registeredEOs.length},
        {label:"Total Event", value:events.length},
        {label:"Pending", value:events.filter(e=>e.moderation_status==="Pending").length},
        {label:"Approved", value:events.filter(e=>e.moderation_status==="Approved").length},
        {label:"Rejected", value:events.filter(e=>e.moderation_status==="Rejected").length},
        {label:"Sponsor", value:`${events.filter(e=>e.is_sponsored).length}/10`},
       ].map(s=>(
        <div key={s.label} className="p-4 rounded-[16px] bg-[#F7F7F8] dark:bg-[#2A2A2A] border">
         <div className="text-[11px] opacity-60 font-bold uppercase">{s.label}</div>
         <div className="text-xl font-black mt-1">{s.value}</div>
        </div>
       ))}
      </div>

      {/* Change PIN - */}
      <div className="mb-6 p-4 rounded-[16px] bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
       <div className="text-xs font-bold mb-2">Ganti PIN Admin</div>
       <div className="flex gap-2">
        <input id="old-pin" placeholder="PIN lama" className="h-11 rounded-xl bg-white dark:bg-[#1E1E1E] border px-4 text-sm w-[120px]" />
        <input id="new-pin" placeholder="PIN baru 4-6 digit" className="h-11 rounded-xl bg-white dark:bg-[#1E1E1E] border px-4 text-sm w-[160px]" />
        <button onClick={handleChangeAdminPin} className="h-11 px-5 rounded-full bg-black text-white font-bold text-sm">Ganti PIN</button>
        <div className="text-[11px] opacity-60 self-center ml-2">PIN sekarang: {adminPin}</div>
       </div>
      </div>

      {adminTab==="moderation" && (
       <div className="grid gap-3">
        {events.length===0 ? <div className="p-8 text-center opacity-60">Belum ada event</div> : events.map(ev=>(
         <div key={ev.id} className="p-4 rounded-[16px] border bg-[#F7F7F8] dark:bg-[#2A2A2A] flex gap-4">
          <img src={ev.poster_url} className="w-[80px] h-[106px] object-cover rounded-xl border" />
          <div className="flex-1 min-w-0">
           <div className="font-bold text-sm truncate">{ev.title} • {ev.moderation_status} {ev.is_sponsored&&`• SPONSOR #${ev.sponsored_priority}`}</div>
           <div className="text-xs opacity-60 mt-1">{ev.province} • {ev.city} • {ev.organizer_name} • 👁 {ev.views} • ⭐ {ev.avg_rating}</div>
           <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={()=>handleModeration(ev.id,"Approved",ev.title)} className="h-8 px-3 rounded-full bg-green-600 text-white text-[11px] font-bold">Approve</button>
            <button onClick={()=>handleModeration(ev.id,"Rejected",ev.title)} className="h-8 px-3 rounded-full bg-[#E53935] text-white text-[11px] font-bold">Reject</button>
            <button onClick={()=>handleModeration(ev.id,"Hidden",ev.title)} className="h-8 px-3 rounded-full bg-gray-600 text-white text-[11px] font-bold">Hidden</button>
            {ev.is_sponsored ? (
             <button onClick={()=>handleModeration(ev.id,"UnSponsor",ev.title)} className="h-8 px-3 rounded-full bg-black text-white text-[11px] font-bold">Un-Sponsor</button>
            ):(
             <button onClick={()=>handleModeration(ev.id,"Sponsor",ev.title)} className="h-8 px-3 rounded-full bg-yellow-500 text-black text-[11px] font-bold">Jadikan Sponsor</button>
            )}
            <button onClick={()=>handleDeleteEvent(ev.id, ev.title)} className="h-8 px-3 rounded-full bg-white dark:bg-[#1E1E1E] border text-[11px] font-bold">Hapus Permanen</button>
           </div>
          </div>
         </div>
        ))}
       </div>
      )}

      {adminTab==="users" && (
       <div className="grid gap-2">
        {registeredUsers.length===0 ? <div className="p-8 text-center opacity-60">Belum ada user terdaftar</div> : registeredUsers.map(u=>(
         <div key={u.username} className="p-3 rounded-xl border bg-[#F7F7F8] dark:bg-[#2A2A2A] flex items-center justify-between text-sm">
          <div><span className="font-bold">{u.username}</span> • {u.displayName} • {new Date(u.created_at).toLocaleDateString('id-ID')}</div>
          <div className="text-[10px] opacity-60">{u.id?.slice(0,8)}</div>
         </div>
        ))}
       </div>
      )}

      {adminTab==="eos" && (
       <div className="grid gap-2">
        {registeredEOs.length===0 ? <div className="p-8 text-center opacity-60">Belum ada EO terdaftar</div> : registeredEOs.map(eo=>(
         <div key={eo.name} className="p-3 rounded-xl border bg-[#F7F7F8] dark:bg-[#2A2A2A] text-sm">
          <div className="font-bold">{eo.name} • {eo.email} • WA {eo.wa} • PIN {eo.pin}</div>
          <div className="text-xs opacity-60">Events: {events.filter(ev=>ev.organizer_id===eo.id).length} • ID: {eo.id?.slice(0,8)}</div>
         </div>
        ))}
       </div>
      )}

      {adminTab==="logs" && (
       <div className="grid gap-2">
        {auditLogs.map(log=>(
         <div key={log.id} className="p-3 rounded-xl border bg-[#F7F7F8] dark:bg-[#2A2A2A] text-xs">
          <span className="font-bold">{log.action}</span> • {log.eventTitle} • by {log.by} • {new Date(log.time).toLocaleString('id-ID')}
         </div>
        ))}
       </div>
      )}
     </div>
    )}

    {/* EO DASHBOARD - SUPABASE */}
    {currentRole==="eo" && (
     <div className="mb-8 p-5 rounded-[24px] bg-white dark:bg-[#1E1E1E] border shadow-sm">
      <div className="font-black text-lg mb-4">Dashboard EO • {currentUser}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
       {[
        {label:"Total Event", value:events.filter(e=>e.organizer_id===currentEOId).length},
        {label:"Approved", value:events.filter(e=>e.organizer_id===currentEOId && e.moderation_status==="Approved").length},
        {label:"Pending", value:events.filter(e=>e.organizer_id===currentEOId && e.moderation_status==="Pending").length},
        {label:"Sponsor", value:`${events.filter(e=>e.organizer_id===currentEOId && e.is_sponsored).length}/10`},
        {label:"Total Views", value:events.filter(e=>e.organizer_id===currentEOId).reduce((s,e)=>s+e.views,0)},
        {label:"Disimpan", value:events.filter(e=>e.organizer_id===currentEOId).reduce((s,e)=>s+e.saves_count,0)},
        {label:"Rating", value:`${(events.filter(e=>e.organizer_id===currentEOId).reduce((s,e)=>s+e.avg_rating,0)/Math.max(1,events.filter(e=>e.organizer_id===currentEOId).filter(e=>e.rating_count>0).length)).toFixed(1)}`},
        {label:"Total Rating", value:events.filter(e=>e.organizer_id===currentEOId).reduce((s,e)=>s+e.rating_count,0)},
       ].map(s=>(
        <div key={s.label} className="p-4 rounded-[16px] bg-[#F7F7F8] dark:bg-[#2A2A2A] border">
         <div className="text-[11px] opacity-60 font-bold uppercase">{s.label}</div>
         <div className="text-xl font-black mt-1">{s.value}</div>
        </div>
       ))}
      </div>

      <div className="grid gap-3">
       {events.filter(e=>e.organizer_id===currentEOId).length===0 ? (
        <div className="p-12 text-center border-2 border-dashed rounded-[16px]">
         <div className="font-bold">Belum ada event</div>
         <div className="text-sm opacity-60 mt-1">Upload event pertamamu, data akan sinkron ke semua device</div>
         <button onClick={()=>{ setEditingEvent(null); setEoFormOpen(true); }} className="mt-4 h-11 px-6 rounded-full bg-[#E53935] text-white font-bold text-sm">Upload Event</button>
        </div>
       ) : events.filter(e=>e.organizer_id===currentEOId).map(ev=>(
        <div key={ev.id} className="p-4 rounded-[16px] border bg-[#F7F7F8] dark:bg-[#2A2A2A] flex gap-4">
         <img src={ev.poster_url} className="w-[80px] h-[106px] object-cover rounded-xl border" />
         <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">{ev.title} • {ev.moderation_status} {ev.is_sponsored&&`• SPONSOR`}</div>
          <div className="text-xs opacity-60 mt-1">{ev.province} • {ev.city} • 👁 {ev.views} • ⭐ {ev.avg_rating} ({ev.rating_count})</div>
          <div className="flex flex-wrap gap-2 mt-3">
           <button onClick={()=>{ setEditingEvent(ev); setNewCategories(ev.categories.filter(c=>c!=="Gratis"&&c!=="Berbayar") as Category[]); setNewTicketType(ev.ticket_type); setPosterPreview(ev.poster_url); setEoFormOpen(true); }} className="h-8 px-3 rounded-full bg-black text-white text-[11px] font-bold">Edit</button>
           <button onClick={()=>handleDeleteEvent(ev.id, ev.title)} className="h-8 px-3 rounded-full bg-[#E53935] text-white text-[11px] font-bold">Hapus Permanen</button>
           <button onClick={()=>handlePromosikan(ev)} className="h-8 px-3 rounded-full bg-green-600 text-white text-[11px] font-bold">Promosikan</button>
          </div>
         </div>
        </div>
       ))}
      </div>
     </div>
    )}

    {/* SPONSORED CAROUSEL */}
    {sponsoredEvents.length>0 && (
     <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
       <div className="font-black text-lg">★ Sponsor Pilihan</div>
       <div className="text-xs opacity-60">{sponsoredEvents.length}/10 slot</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
       {sponsoredEvents.map(ev=>(
        <div key={ev.id} onClick={()=>handleViewEvent(ev)} className="group cursor-pointer rounded-[24px] overflow-hidden border bg-white dark:bg-[#1E1E1E] shadow-sm hover:shadow-md transition">
         <div className="relative aspect-[3/4] overflow-hidden">
          <img src={ev.poster_url} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
          <div className="absolute top-3 left-3 flex gap-2">
           <span className="px-2.5 py-1 rounded-full bg-[#E53935] text-white text-[10px] font-black">★ SPONSOR #{ev.sponsored_priority}</span>
           <span className="px-2.5 py-1 rounded-full bg-black/70 text-white text-[10px] font-bold backdrop-blur">{getTimeStatus(ev)}</span>
          </div>
         </div>
         <div className="p-4">
          <div className="font-bold text-sm line-clamp-2">{ev.title}</div>
          <div className="text-xs opacity-60 mt-1">{ev.province} • {ev.city} • ⭐ {ev.avg_rating} • 👁 {ev.views}</div>
         </div>
        </div>
       ))}
      </div>
     </div>
    )}

    {/* FILTERS */}
    <div className="mb-6 p-4 rounded-[20px] bg-white dark:bg-[#1E1E1E] border shadow-sm">
     <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari event..." className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />
      <select value={selectedProv} onChange={e=>{ setSelectedProv(e.target.value); setSelectedCity("Semua"); }} className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm">
       <option>Semua</option>{ALL_PROVINCES.map(p=><option key={p}>{p}</option>)}
      </select>
      <input value={selectedCity} onChange={e=>setSelectedCity(e.target.value)} placeholder="Kota (ketik)" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />
      <select value={selectedCat} onChange={e=>setSelectedCat(e.target.value as any)} className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm">
       <option>Semua</option><option>Cosplay</option><option>Idol</option><option>Toys Event</option><option>Market Event</option><option>Gratis</option><option>Berbayar</option>
      </select>
      <select value={selectedTicket} onChange={e=>setSelectedTicket(e.target.value as any)} className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm">
       <option>Semua</option><option>Gratis</option><option>Berbayar</option>
      </select>
     </div>
     <div className="flex gap-2 mt-3">
      {(["Terbaru","Terpopuler"] as const).map(m=>(
       <button key={m} onClick={()=>setSortMode(m as any)} className={`h-9 px-4 rounded-full text-xs font-bold border ${sortMode===m?"bg-black text-white border-black":"bg-[#F7F7F8] dark:bg-[#2A2A2A]"}`}>{m}</button>
      ))}
      <button onClick={()=>{ setSearch(""); setSelectedProv("Semua"); setSelectedCity("Semua"); setSelectedCat("Semua"); setSelectedTicket("Semua"); setSortMode("Terbaru"); }} className="h-9 px-4 rounded-full bg-white dark:bg-[#2A2A2A] border text-xs font-bold">Reset</button>
      <div className="ml-auto text-xs opacity-60 self-center">Event ({approvedEvents.length})</div>
     </div>
    </div>

    {/* GRID */}
    {approvedEvents.length===0 ? (
     <div className="py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-[#F7F7F8] dark:bg-[#2A2A2A] border flex items-center justify-center mx-auto mb-4 text-xl">📭</div>
      <div className="font-bold">Belum ada event</div>
      <div className="text-sm opacity-60 mt-1">Jadilah yang pertama upload event</div>
      <div className="text-[11px] opacity-40 mt-2"></div>
     </div>
    ):(
     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {approvedEvents.map(ev=>(
       <div key={ev.id} onClick={()=>handleViewEvent(ev)} className="group cursor-pointer rounded-[20px] overflow-hidden border bg-white dark:bg-[#1E1E1E] shadow-sm hover:shadow-md transition">
        <div className="relative aspect-[3/4] overflow-hidden bg-[#F7F7F8]">
         <img src={ev.poster_url} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
         <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
          {ev.is_sponsored && <span className="px-2 py-1 rounded-full bg-[#E53935] text-white text-[9px] font-black">★ SPONSOR</span>}
          <span className={`px-2 py-1 rounded-full text-[9px] font-bold backdrop-blur ${getTimeStatus(ev)==="Upcoming"?"bg-blue-600 text-white":getTimeStatus(ev)==="Ongoing"?"bg-green-600 text-white":"bg-black/70 text-white"}`}>{getTimeStatus(ev)}</span>
         </div>
         <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
          <span className="px-2 py-1 rounded-full bg-black/70 text-white text-[9px] font-bold backdrop-blur">{ev.ticket_type}</span>
          <span className="px-2 py-1 rounded-full bg-black/70 text-white text-[9px] font-bold backdrop-blur">👁 {ev.views}</span>
         </div>
        </div>
        <div className="p-3">
         <div className="font-bold text-[13px] leading-tight line-clamp-2">{ev.title}</div>
         <div className="text-[11px] opacity-60 mt-1 truncate">{ev.province} • {ev.city} • ⭐ {ev.avg_rating} ({ev.rating_count})</div>
         <div className="flex gap-1.5 mt-2 flex-wrap">
          {ev.categories.slice(0,2).map(c=><span key={c} className="px-2 py-0.5 rounded-full bg-[#F7F7F8] dark:bg-[#2A2A2A] border text-[9px] font-bold">{c}</span>)}
         </div>
        </div>
       </div>
      ))}
     </div>
    )}

    {/* DETAIL MODAL */}
    {selectedEvent && (
     <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setSelectedEvent(null)}></div>
      <div className="relative w-full max-w-[640px] max-h-[90vh] overflow-auto rounded-[24px] bg-white dark:bg-[#1A1A1A] border shadow-2xl">
       <button onClick={()=>setSelectedEvent(null)} className="absolute top-3 right-3 z-10 w-11 h-11 rounded-full bg-black/70 text-white backdrop-blur flex items-center justify-center font-bold">✕</button>
       <div className="relative aspect-[3/4] max-h-[400px] overflow-hidden">
        <img src={selectedEvent.poster_url} className="w-full h-full object-cover" />
        <div className="absolute top-3 left-3 flex gap-2">
         {selectedEvent.is_sponsored && <span className="px-3 py-1 rounded-full bg-[#E53935] text-white text-xs font-black">★ SPONSOR #{selectedEvent.sponsored_priority}</span>}
         <span className="px-3 py-1 rounded-full bg-black/70 text-white text-xs font-bold backdrop-blur">{getTimeStatus(selectedEvent)}</span>
        </div>
       </div>
       <div className="p-6">
        <div className="font-black text-xl leading-tight">{selectedEvent.title}</div>
        <div className="text-sm opacity-70 mt-2">{selectedEvent.province} • {selectedEvent.city} • {selectedEvent.venue_address}</div>
        <div className="text-sm mt-4 leading-relaxed">{selectedEvent.description}</div>
        <div className="flex flex-wrap gap-2 mt-4">
         {selectedEvent.categories.map(c=><span key={c} className="px-3 py-1 rounded-full bg-[#F7F7F8] dark:bg-[#2A2A2A] border text-xs font-bold">{c}</span>)}
        </div>
        {selectedEvent.ticket_url && <a href={selectedEvent.ticket_url} target="_blank" className="mt-4 inline-flex h-11 px-5 rounded-full bg-black text-white font-bold text-sm items-center">Beli Tiket</a>}
        {selectedEvent.registration_url && <a href={selectedEvent.registration_url} target="_blank" className="mt-2 ml-2 inline-flex h-11 px-5 rounded-full bg-white dark:bg-[#2A2A2A] border font-bold text-sm items-center">Daftar Lomba</a>}
        <div className="grid grid-cols-3 gap-3 mt-6">
         <div className="p-3 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border text-center"><div className="text-[11px] opacity-60">Views</div><div className="font-black">👁 {selectedEvent.views}</div></div>
         <div className="p-3 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border text-center"><div className="text-[11px] opacity-60">Rating</div><div className="font-black">⭐ {selectedEvent.avg_rating}</div></div>
         <div className="p-3 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border text-center"><div className="text-[11px] opacity-60">Disimpan</div><div className="font-black">{selectedEvent.saves_count}</div></div>
        </div>
        <div className="flex flex-wrap gap-2 mt-6">
         <button onClick={()=>handleSaveEvent(selectedEvent.id)} className={`h-11 px-5 rounded-full font-bold text-sm border ${savedIds.includes(selectedEvent.id)?"bg-black text-white border-black":"bg-white dark:bg-[#2A2A2A]"}`}>{savedIds.includes(selectedEvent.id)?"★ Tersimpan":"☆ Simpan"}</button>
         <button onClick={()=>handlePromosikan(selectedEvent)} className="h-11 px-5 rounded-full bg-green-600 text-white font-bold text-sm">Promosikan</button>
         {(currentRole==="admin" || (currentRole==="eo" && selectedEvent.organizer_id===currentEOId)) && (
          <button onClick={()=>handleDeleteEvent(selectedEvent.id, selectedEvent.title)} className="h-11 px-5 rounded-full bg-[#E53935] text-white font-bold text-sm">Hapus Permanen (DB)</button>
         )}
        </div>
        <div className="mt-4 text-[11px] opacity-50">ID: {selectedEvent.id} • Organizer: {selectedEvent.organizer_name} • Sinkron semua device</div>
       </div>
      </div>
     </div>
    )}

    {/* LOGIN USER MODAL */}
    {showLoginUser && (
     <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setShowLoginUser(false)}></div>
      <div className="relative w-full max-w-[360px] rounded-[24px] bg-white dark:bg-[#1A1A1A] border shadow-2xl p-6">
       <div className="font-black text-lg">Masuk User</div>
       <div className="text-xs opacity-60 mt-1">Masuk untuk melanjutkan</div>
       <div className="mt-5 grid gap-3">
        <input id="login-user-username" placeholder="Username (lowercase)" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />
        <input id="login-user-pass" type="password" placeholder="Password" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />
       </div>
       <button onClick={handleLoginUser} className="mt-5 w-full h-11 rounded-full bg-black text-white font-bold text-sm">Masuk</button>
       <div className="mt-3 text-center text-xs"><button onClick={()=>{ setShowLoginUser(false); setShowRegUser(true); }} className="font-bold underline">Belum punya akun? Daftar</button></div>
      </div>
     </div>
    )}

    {/* REGISTER USER */}
    {showRegUser && (
     <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setShowRegUser(false)}></div>
      <div className="relative w-full max-w-[360px] rounded-[24px] bg-white dark:bg-[#1A1A1A] border shadow-2xl p-6">
       <div className="font-black text-lg">Daftar User</div>
       <div className="mt-5 grid gap-3">
        <input id="reg-user-username" placeholder="Username lowercase min 3, ex: zefandra" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />
        <input id="reg-user-display" placeholder="Display name" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />
        <input id="reg-user-pass" type="password" placeholder="Password min 8 huruf+angka" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />
       </div>
       <button onClick={handleRegisterUser} className="mt-5 w-full h-11 rounded-full bg-black text-white font-bold text-sm">Daftar & Sinkron</button>
      </div>
     </div>
    )}

    {/* LOGIN EO */}
    {showLoginEO && (
     <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setShowLoginEO(false)}></div>
      <div className="relative w-full max-w-[360px] rounded-[24px] bg-white dark:bg-[#1A1A1A] border shadow-2xl p-6">
       <div className="font-black text-lg">Masuk EO</div>
       <div className="mt-5 grid gap-3">
        <input id="login-eo-name" placeholder="Nama EO" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />
        <input id="login-eo-pass" type="password" placeholder="Password" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />
        <input id="login-eo-pin" placeholder="PIN 6 digit" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />
       </div>
       <button onClick={handleLoginEO} className="mt-5 w-full h-11 rounded-full bg-[#E53935] text-white font-bold text-sm">Masuk EO</button>
       <div className="mt-3 text-center text-xs"><button onClick={()=>{ setShowLoginEO(false); setShowRegEO(true); }} className="font-bold underline">Daftar EO</button></div>
      </div>
     </div>
    )}

    {/* REGISTER EO */}
    {showRegEO && (
     <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setShowRegEO(false)}></div>
      <div className="relative w-full max-w-[400px] rounded-[24px] bg-white dark:bg-[#1A1A1A] border shadow-2xl p-6 max-h-[90vh] overflow-auto">
       <div className="font-black text-lg">Daftar EO</div>
       <div className="mt-5 grid gap-3">
        <input id="reg-eo-name" placeholder="Nama EO unik" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />
        <input id="reg-eo-email" placeholder="Email valid" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />
        <input id="reg-eo-wa" placeholder="WA min 10 digit, ex: 0813..." className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />
        <input id="reg-eo-pass" type="password" placeholder="Password min 8" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />
        <input id="reg-eo-pin" placeholder="PIN 6 digit angka" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />
        <select id="reg-eo-prov" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm">{ALL_PROVINCES.map(p=><option key={p}>{p}</option>)}</select>
        <input id="reg-eo-city" placeholder="Kota" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />
       </div>
       <button onClick={handleRegisterEO} className="mt-5 w-full h-11 rounded-full bg-[#E53935] text-white font-bold text-sm">Daftar EO & Sinkron</button>
      </div>
     </div>
    )}

    {/* ADMIN LOGIN */}
    {showAdmin && currentRole!=="admin" && (
     <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setShowAdmin(false)}></div>
      <div className="relative w-full max-w-[360px] rounded-[24px] bg-white dark:bg-[#1A1A1A] border shadow-2xl p-6">
       <div className="font-black text-lg">Admin</div>
       <div className="text-xs opacity-60 mt-1">Akses admin</div>
       <div className="mt-5 grid gap-3">
        <input id="admin-user" defaultValue="makicos" placeholder="Username admin" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />
        <input id="admin-pin" type="password" placeholder={`PIN (saat ini ${adminPin})`} className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />
       </div>
       <button onClick={handleLoginAdmin} className="mt-5 w-full h-11 rounded-full bg-black text-white font-bold text-sm">Masuk Admin</button>
       <div className="mt-3 text-[11px] opacity-50 text-center">Akses rahasia: klik logo 5x dalam 4 detik atau Ctrl+Shift+A atau #admin</div>
      </div>
     </div>
    )}

    {/* EO FORM - SUPABASE UPLOAD */}
    {eoFormOpen && (
     <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setEoFormOpen(false)}></div>
      <div className="relative w-full max-w-[480px] rounded-[24px] bg-white dark:bg-[#1A1A1A] border shadow-2xl p-6 max-h-[90vh] overflow-auto">
       <div className="font-black text-lg">{editingEvent?"Edit Event":"Upload Event Baru"}</div>
       <div className="text-xs opacity-60 mt-1">Poster rasio 3:4, max 3MB</div>
       <div className="mt-5 grid gap-4">
        <input id="new-title" defaultValue={editingEvent?.title||""} placeholder="Nama event" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" />
        <textarea id="new-desc" defaultValue={editingEvent?.description||""} placeholder="Deskripsi event min 20 karakter" className="min-h-[80px] rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border p-3 text-sm" />
        <div className="p-4 rounded-[16px] border-2 border-dashed"><div className="text-xs font-bold">Poster 3:4 (max 3MB)</div><input type="file" accept="image/*" onChange={e=>{ const f=e.target.files?.[0]; if(f) handlePosterUpload(f, setPosterPreview); }} className="mt-2 w-full text-xs" />{posterPreview && <img src={posterPreview} className="mt-3 w-full h-48 object-cover rounded-xl border" />}{posterError && <div className="mt-2 text-[11px] text-[#E53935] bg-[#E53935]/10 p-2 rounded-xl border border-[#E53935]/20">{posterError}</div>}</div>
        <div className="p-4 rounded-[16px] bg-[#F7F7F8] dark:bg-[#2A2A2A] border">
         <div className="text-xs font-bold mb-2">Kategori (pilih minimal 1)</div>
         <div className="grid grid-cols-2 gap-2">
          {eventCategoryOptions.map(cat=>{
           const checked = newCategories.includes(cat);
           return (<label key={cat} className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${checked?"bg-black text-white border-black":"bg-white dark:bg-[#1E1E1E]"}`}><input type="checkbox" checked={checked} onChange={e=>{ if(e.target.checked) setNewCategories(prev=>[...prev, cat]); else setNewCategories(prev=>prev.filter(c=>c!==cat)); }} className="w-4 h-4" /><span className="text-xs font-bold">{cat}</span></label>)
          })}
         </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
         <select value={newTicketType} onChange={e=>setNewTicketType(e.target.value as TicketType)} className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm"><option value="Gratis">Gratis</option><option value="Berbayar">Berbayar</option></select>
         <select id="new-prov" defaultValue={editingEvent?.province||"Banten"} className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm">{ALL_PROVINCES.map(p=><option key={p}>{p}</option>)}</select>
        </div>
        <div className="grid grid-cols-2 gap-2"><input id="new-city" defaultValue={editingEvent?.city||""} placeholder="Kota" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><input id="new-venue" defaultValue={editingEvent?.venue_address||""} placeholder="Alamat venue" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /></div>
        {newTicketType==="Berbayar" && (<div className="p-3 rounded-[12px] bg-blue-50 dark:bg-blue-900/20 border border-blue-200"><div className="text-xs font-bold">Link tiket (wajib jika Berbayar)</div><input id="new-ticket-url" defaultValue={editingEvent?.ticket_url||""} placeholder="https://..." className="mt-2 w-full h-11 rounded-xl bg-white dark:bg-[#1E1E1E] border px-4 text-sm" /></div>)}
        <div className="p-3 rounded-[12px] bg-[#F7F7F8] dark:bg-[#2A2A2A] border"><div className="text-xs font-bold">Link lomba (opsional)</div><input id="new-lomba-url" defaultValue={editingEvent?.registration_url||""} placeholder="https://..." className="mt-2 w-full h-11 rounded-xl bg-white dark:bg-[#1E1E1E] border px-4 text-sm" /></div>
        <div className="grid grid-cols-2 gap-2"><input id="new-start" defaultValue={editingEvent?.start_date||""} type="date" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /><input id="new-end" defaultValue={editingEvent?.end_date||""} type="date" className="h-11 rounded-xl bg-[#F7F7F8] dark:bg-[#2A2A2A] border px-4 text-sm" /></div>
       </div>
       <button onClick={handleCreateEvent} className="mt-5 w-full h-12 rounded-full bg-black text-white font-bold text-sm">{editingEvent?"Simpan Perubahan":"Upload Event"}</button>
       <div className="mt-2 text-[11px] opacity-50 text-center">Event akan direview admin sebelum tampil</div>
      </div>
     </div>
    )}

    {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-5 py-2.5 rounded-full text-sm z-[90] shadow-xl border border-white/10 max-w-[90vw] text-center">{toast}</div>}
   </div>

   <footer className="border-t mt-12 py-8">
    <div className="max-w-[1280px] mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
     <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-xl bg-[#E53935] flex items-center justify-center text-white font-black">N</div>
      <div><div className="font-black text-sm">NGIPEN</div><div className="text-[11px] opacity-60">Satu Hobby Satu Keseruan • {events.length} event</div></div>
     </div>
     <div className="text-[11px] opacity-50">© 2026 Makicos ID • Rangkasbitung, Banten</div>
    </div>
   </footer>
  </div>
 );
}
