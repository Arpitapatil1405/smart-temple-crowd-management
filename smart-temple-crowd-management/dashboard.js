
"use strict";

const SUPABASE_URL = "https://vdcxvxtgkzwsknxmevwt.supabase.co";
const SUPABASE_KEY = "sb_publishable_xKYJqVUJ9CzA7TFxKKKjKQ_Nn6bdDLM";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = id => document.getElementById(id);

let temples = [], currentTab = "active", activeUser = null, activeProfile = null;
let toastTimer, selectedZone = "A", selectedSlot = "", slotRequest = 0;
let currentPassToken = "";

const demoTemples = [
  ["Shree Siddhivinayak Temple","Mumbai"],
  ["Meenakshi Amman Temple","Madurai"],
  ["Jagannath Temple","Puri"],
  ["Somnath Temple","Prabhas Patan"],
  ["Kedarnath Temple","Kedarnath"],
  ["Badrinath Temple","Badrinath"],
  ["Trimbakeshwar Temple","Trimbak"],
  ["Shirdi Sai Baba Temple","Shirdi"],
  ["Kashi Vishwanath Temple","Varanasi"],
  ["Tirupati Balaji Temple","Tirupati"],
  ["Golden Temple","Amritsar"],
  ["Mahakaleshwar Temple","Ujjain"],
  ["Vaishno Devi Temple","Katra"],
  ["Akshardham Temple","Delhi"],
  ["Dwarkadhish Temple","Dwarka"],
  ["Ramanathaswamy Temple","Rameswaram"],
  ["Someshwar Temple","Pune"],
  ["Mahalakshmi Temple","Kolhapur"],
  ["Dagadusheth Halwai Ganpati","Pune"],
  ["Murudeshwar Temple","Murudeshwar"],
  ["Padmanabhaswamy Temple","Thiruvananthapuram"],
  ["Birla Mandir","Hyderabad"]
].map(([name,city],i)=>({
  id:`sample-${i+1}`, name, city, sample:true
}));

function txt(tag,cls,value) {
  const e=document.createElement(tag);
  if(cls) e.className=cls;
  e.textContent=value??"";
  return e;
}

function localDate(d=new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function token(prefix="ST") {
  return `${prefix}-${crypto.randomUUID().replaceAll("-","").slice(0,10).toUpperCase()}`;
}

function showToast(m) {
  $("toast").textContent=m;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>$("toast").classList.remove("show"),3500);
}

function readLocal(k) {
  try { return JSON.parse(localStorage.getItem(k)||"[]"); }
  catch { return []; }
}

function saveLocal(k,v) {
  try {
    localStorage.setItem(k,JSON.stringify(v));
    return true;
  } catch {
    showToast("Could not save data in this browser.");
    return false;
  }
}

function openModal(id) {
  document.querySelectorAll(".overlay.open").forEach(m=>{
    m.classList.remove("open");
    m.setAttribute("aria-hidden","true");
  });
  $(id).classList.add("open");
  $(id).setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";
}

function closeModal(id) {
  const m=typeof id==="string"?$(id):id;
  if(!m) return;
  m.classList.remove("open");
  m.setAttribute("aria-hidden","true");
  if(!document.querySelector(".overlay.open")) document.body.style.overflow="";
}

function addField(form,labelText,id,type="text",placeholder="") {
  const l=txt("label","",labelText);
  const i=document.createElement(type==="textarea"?"textarea":"input");
  i.id=id;
  if(type!=="textarea") i.type=type;
  if(placeholder) i.placeholder=placeholder;
  l.appendChild(i);
  form.appendChild(l);
  return i;
}

function addSelect(form,labelText,id,opts) {
  const l=txt("label","",labelText);
  const s=document.createElement("select");
  s.id=id;
  opts.forEach(([v,t])=>s.add(new Option(t,v)));
  l.appendChild(s);
  form.appendChild(l);
  return s;
}

function addButton(c,label,handler,cls="primary") {
  const b=txt("button",cls,label);
  b.type="button";
  b.addEventListener("click",handler);
  c.appendChild(b);
  return b;
}

function formatTime(v) {
  if(!v) return "";
  const [h,m]=v.split(":").map(Number);
  return `${String(h%12||12).padStart(2,"0")}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`;
}

function formatSlot(a,b) {
  return `${formatTime(a)} - ${formatTime(b)}`;
}

function st(v) {
  return String(v||"").toLowerCase();
}

/* --------------------------------------------------
   DEMO CROWD DENSITY AND DEITY-BASED FESTIVAL DATA
   These are illustrative values, not live measurements.
-------------------------------------------------- */

function getTempleCrowdInfo(temple) {
  const name=(temple.name||"").toLowerCase();
  const day=new Date().getDay();

  let deity="General";
  let busyDays=[];
  let festivals=[];

  if(/ganpati|ganesh|siddhivinayak|dagadusheth/.test(name)) {
    deity="Ganesh";
    busyDays=[2];
    festivals=["Ganesh Chaturthi","Sankashti Chaturthi"];
  } else if(/somnath|mahakaleshwar|trimbakeshwar|someshwar|kedarnath|shiva/.test(name)) {
    deity="Shiva";
    busyDays=[1];
    festivals=["Maha Shivratri","Shravan"];
  } else if(/jagannath/.test(name)) {
    deity="Jagannath";
    busyDays=[0];
    festivals=["Rath Yatra","Snana Yatra"];
  } else if(/shirdi sai/.test(name)) {
    deity="Sai Baba";
    busyDays=[4];
    festivals=["Guru Purnima","Ram Navami"];
  } else if(/mahalakshmi|vaishno devi|durga/.test(name)) {
    deity="Devi";
    busyDays=[5];
    festivals=["Navratri","Durga Puja"];
  } else if(/tirupati|balaji|badrinath|padmanabhaswamy/.test(name)) {
    deity="Vishnu";
    busyDays=[4];
    festivals=["Janmashtami","Vaikuntha Ekadashi"];
  } else if(/dwarkadhish/.test(name)) {
    deity="Krishna";
    busyDays=[4];
    festivals=["Janmashtami","Holi"];
  } else if(/meenakshi/.test(name)) {
    deity="Meenakshi";
    busyDays=[5];
    festivals=["Chithirai Festival","Navratri"];
  } else if(/rameswaram/.test(name)) {
    deity="Ramanathaswamy";
    busyDays=[1];
    festivals=["Maha Shivratri","Aadi Amavasai"];
  } else if(/murudeshwar/.test(name)) {
    deity="Shiva";
    busyDays=[1];
    festivals=["Maha Shivratri","Karthika Deepotsava"];
  } else if(/golden temple/.test(name)) {
    deity="Sikh Shrine";
    busyDays=[0,6];
    festivals=["Gurpurab","Baisakhi"];
  } else if(/akshardham|birla mandir/.test(name)) {
    deity="Vishnu / Swaminarayan";
    busyDays=[0];
    festivals=["Janmashtami","Diwali"];
  } else if(/kashi vishwanath/.test(name)) {
    deity="Shiva";
    busyDays=[1];
    festivals=["Maha Shivratri","Dev Deepawali"];
  } else {
    busyDays=[0,4];
    festivals=["Annual Temple Festival","Diwali"];
  }

  const seed=[...name].reduce((sum,ch)=>sum+ch.charCodeAt(0),0);
  const levels=["Low","Moderate","High"];
  let level=levels[(seed+day)%levels.length];

  if(busyDays.includes(day)) level="High";

  const dayNumber=Math.floor(Date.now()/86400000);
  const showFestival=(seed+dayNumber)%4===0;
  const festivalName=showFestival
    ? festivals[(seed+dayNumber)%festivals.length]
    : "";

  return {deity,level,festivalName};
}

/* --------------------------------------------------
   DASHBOARD INITIALIZATION
-------------------------------------------------- */

async function init() {
  try {
    const { data, error } = await sb.auth.getSession();

    if (error) throw error;

    if (!data.session) {
      location.replace("./login.html");
      return;
    }

    activeUser = data.session.user;

    const metadata = activeUser.user_metadata || {};
    const fallbackName =
      metadata.full_name ||
      metadata.name ||
      activeUser.email?.split("@")[0] ||
      "Devotee";

    activeProfile = {
      id: activeUser.id,
      full_name: fallbackName,
      email: activeUser.email || "",
      role: "devotee"
    };

    $("devoteeName").textContent = fallbackName;
    $("devoteeEmail").textContent = activeUser.email || "";
    $("avatar").textContent = fallbackName.charAt(0).toUpperCase();

    $("bookingName").value = fallbackName;
    $("bookingDate").min = localDate();
    $("bookingDate").value = localDate(
      new Date(Date.now() + 86400000)
    );

    try {
      const { data: profile, error: profileError } = await sb
        .from("profiles")
        .select("id,full_name,email,role")
        .eq("id", activeUser.id)
        .maybeSingle();

      if (profileError) {
        console.warn("Profile lookup failed:", profileError.message);
      } else if (profile) {
        activeProfile = profile;

        const name = profile.full_name || fallbackName;

        $("devoteeName").textContent = name;
        $("devoteeEmail").textContent =
          profile.email || activeUser.email || "";
        $("avatar").textContent = name.charAt(0).toUpperCase();
        $("bookingName").value = name;
      }
    } catch (profileError) {
      console.warn("Using Auth profile details:", profileError);
    }

    bindEvents();
    await loadTemples();
    await loadBookings();

  } catch (error) {
    console.error("Dashboard initialisation:", error);
    showToast(
      `Dashboard could not load: ${error.message || "Check the browser console."}`
    );
  }
}

/* --------------------------------------------------
   TEMPLE LIST AND PLACARDS
-------------------------------------------------- */

async function loadTemples() {
  try {
    const {data,error}=await sb
      .from("temples")
      .select("id,name,city")
      .order("name");

    if(error) throw error;

    temples=(data||[]).filter(t=>t.name);

    if(!temples.length) throw new Error("No temple records");

  } catch(e) {
    console.error("Temple list:",e.message);
    temples=demoTemples;
    showToast("Showing example temples; booking is enabled only for database temples.");
  }

  const f=$("cityFilter");
  f.replaceChildren(new Option("All Cities","all"));

  [...new Set(temples.map(t=>t.city).filter(Boolean))]
    .sort()
    .forEach(c=>f.add(new Option(c,c)));

  renderTemples();
}

function renderTemples() {
  const q=$("templeSearch").value.trim().toLowerCase();
  const city=$("cityFilter").value;

  const found=temples.filter(t=>
    ((t.name||"").toLowerCase().includes(q)||
     (t.city||"").toLowerCase().includes(q))&&
    (city==="all"||t.city===city)
  );

  $("templeCount").textContent=`${found.length} temples available`;

  const grid=$("templeGrid");
  grid.replaceChildren();

  if(!found.length) {
    grid.appendChild(txt("p","empty","No temples found. Try another search."));
    return;
  }

  found.forEach(t=>{
    const info=getTempleCrowdInfo(t);
    const c=txt("article","temple-card","");

    const heading=txt("div","temple-card-heading","");
    heading.appendChild(txt("h3","",t.name));

    if(info.festivalName) {
      const badge=txt("span","festival-badge","⚑ FESTIVAL");
      badge.title=info.festivalName;
      heading.appendChild(badge);
    }

    c.appendChild(heading);
    c.appendChild(txt("p","temple-city",`⌖ ${t.city||"City not listed"}`));

    const crowd=txt(
      "div",
      `crowd-density crowd-${info.level.toLowerCase()}`,
      ""
    );

    crowd.appendChild(txt("span","crowd-label","Crowd density"));
    crowd.appendChild(txt("span","crowd-value",`● ${info.level.toUpperCase()}`));
    c.appendChild(crowd);

    if(info.festivalName) {
      c.appendChild(txt("p","festival-detail",`✦ ${info.festivalName}`));
    }

    c.appendChild(txt("p","crowd-demo-note","Demo estimate · Not live data"));
    c.appendChild(txt("div","temple-rule",""));

    const meta=txt("div","temple-meta","");
    meta.appendChild(txt("small","","DARSHAN BOOKING"));
    meta.appendChild(txt("span","",t.sample?"DEMO LISTING":"VISIT DETAILS"));
    c.appendChild(meta);

    const b=txt("button","book-temple","Book Darshan →");
    b.type="button";
    b.addEventListener("click",()=>openBooking(t));
    c.appendChild(b);

    grid.appendChild(c);
  });
}

/* --------------------------------------------------
   DARSHAN BOOKING
-------------------------------------------------- */

function openBooking(t) {
  if(!t||t.sample) {
    showToast("This is an example listing. Choose a temple loaded from Supabase to book.");
    return;
  }

  const s=$("bookingTemple");
  s.replaceChildren();

  temples.filter(x=>!x.sample).forEach(x=>
    s.add(new Option(
      `${x.name}${x.city?" ("+x.city+")":""}`,
      x.id
    ))
  );

  s.value=t.id;
  $("bookingName").value=$("devoteeName").textContent;
  $("bookingForm").hidden=false;
  $("passArea").hidden=true;
  $("bookingMessage").textContent="";
  openModal("bookingModal");
  loadAvailableSlots();
}

async function loadAvailableSlots() {
  const req=++slotRequest;
  const s=$("bookingTime");
  const tid=$("bookingTemple").value;
  const date=$("bookingDate").value;

  s.disabled=true;
  s.replaceChildren(new Option("Loading available slots...",""));

  if(!tid||!date||date<localDate()) {
    s.replaceChildren(new Option("Choose a valid date",""));
    s.disabled=false;
    return;
  }

  try {
    const {data,error}=await sb.rpc(
      "get_available_darshan_slots",
      {p_temple_id:tid,p_slot_date:date}
    );

    if(error) throw error;
    if(req!==slotRequest) return;

    const now=new Date().toTimeString().slice(0,8);

    const available=(data||[]).filter(x=>
      x.is_open&&
      Number(x.available_devotees)>0&&
      !(date===localDate()&&x.slot_start<=now)
    );

    s.replaceChildren();

    if(!available.length) {
      s.add(new Option("No available slots for this date",""));
      return;
    }

    available.forEach(x=>
      s.add(new Option(
        `${formatSlot(x.slot_start,x.slot_end)} · ${x.available_devotees} places left`,
        x.slot_id
      ))
    );

  } catch(e) {
    console.error("Slot availability:",e);
    if(req===slotRequest) {
      s.replaceChildren(new Option("Could not load slots",""));
      showToast("Unable to load slots. Check Supabase and try again.");
    }
  } finally {
    if(req===slotRequest) s.disabled=false;
  }
}

async function createBooking(event) {
  event.preventDefault();

  const temple=temples.find(t=>t.id===$("bookingTemple").value);
  const slot=$("bookingTime").value;
  const date=$("bookingDate").value;
  const name=$("bookingName").value.trim();
  const count=Number($("bookingCount").value);
  const mobile=$("bookingMobile").value.trim();

  if(!temple||temple.sample||!slot) {
    showToast("Choose a temple and available time slot.");
    return;
  }

  if(!date||date<localDate()) {
    showToast("Choose a valid date.");
    return;
  }

  if(!name||!Number.isInteger(count)||count<1||count>5) {
    showToast("Check devotee details.");
    return;
  }

  if(mobile&&!/^[0-9]{10}$/.test(mobile)) {
    showToast("Enter a valid 10-digit mobile number.");
    return;
  }

  const btn=$("confirmBooking");
  btn.disabled=true;
  btn.textContent="Saving booking...";
  $("bookingMessage").textContent="";

  try {
    const {data:session,error:se}=await sb.auth.getSession();
    if(se) throw se;
    if(!session.session) throw new Error("Please log in again.");

    const {data:r,error}=await sb.rpc(
      "reserve_darshan_slot",
      {p_slot_id:slot,p_devotee_count:count}
    );

    if(error) throw error;

    if(!r?.booking_id||!r?.booking_ref) {
      throw new Error("No booking confirmation was returned.");
    }

    const {data:b,error:be}=await sb
      .from("devotee_booking_history")
      .select("*")
      .eq("id",r.booking_id)
      .eq("devotee_id",activeUser.id)
      .single();

    if(be) throw be;

    renderPass({
      temple_name:b.temple_name,
      temple_city:b.temple_city,
      devotee_name:name,
      devotee_count:b.devotee_count,
      darshan_date:b.booking_date,
      time_slot:formatSlot(b.slot_start,b.slot_end),
      booking_token:b.booking_ref
    });

    await loadBookings();
    showToast("Darshan booking confirmed!");

  } catch(e) {
    console.error("Booking:",e);
    $("bookingMessage").textContent=e.message||"Booking failed. Please try again.";
    await loadAvailableSlots();
  } finally {
    btn.disabled=false;
    btn.textContent="Confirm Darshan Booking →";
  }
}

function getHostedPassUrl(bookingToken, autoPrint=false) {
  const passUrl = new URL("./darshan-pass.html", window.location.href);
  passUrl.search = "";
  passUrl.searchParams.set("token", bookingToken);

  if(autoPrint) {
    passUrl.searchParams.set("autoprint", "1");
  }

  return passUrl.href;
}

function renderPass(b) {
  currentPassToken = b.booking_token || "";

  $("bookingForm").hidden = true;
  $("passArea").hidden = false;
  $("passTemple").textContent = b.temple_name || "";
  $("passCity").textContent = b.temple_city || "City not listed";
  $("passName").textContent = b.devotee_name || $("devoteeName").textContent;
  $("passCount").textContent = b.devotee_count ?? "";
  $("passDate").textContent = b.darshan_date || "";
  $("passTime").textContent = b.time_slot || "";
  $("passToken").textContent = currentPassToken;

  const qr = $("passQR");
  qr.replaceChildren();

  if (window.QRCode && currentPassToken) {
    new QRCode(qr, {
      text: getHostedPassUrl(currentPassToken),
      width: 180,
      height: 180,
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    qr.appendChild(txt("p", "notice", "Unable to generate QR code."));
  }

  qr.appendChild(txt(
    "p",
    "notice",
    "Project-generated pass only; not an official temple entry permit."
  ));
}

/* --------------------------------------------------
   ACTIVE AND PAST BOOKINGS
-------------------------------------------------- */

async function loadBookings() {
  if(!activeUser) return;

  const {data,error}=await sb
    .from("devotee_booking_history")
    .select("*")
    .eq("devotee_id",activeUser.id)
    .order("created_at",{ascending:false});

  if(error) {
    console.error("Load bookings:",error);
    showToast("Unable to load bookings. Check view permissions.");
    return;
  }

  window.myBookings=data||[];
  renderBookings();
}

function renderBookings() {
  const all=window.myBookings||[];
  const today=localDate();

  const up=all.filter(b=>
    b.booking_date>=today&&st(b.status)==="confirmed"
  );

  const past=all.filter(b=>
    b.booking_date<today||
    ["completed","cancelled"].includes(st(b.status))
  );

  $("activeCount").textContent=up.length;
  $("pastCount").textContent=past.length;
  $("bookingTotal").textContent=`${all.length} Total`;

  const list=$("bookingsList");
  list.replaceChildren();

  const shown=currentTab==="active"?up:past;

  if(!shown.length) {
    list.appendChild(txt(
      "p",
      "empty",
      currentTab==="active"?"No upcoming bookings yet.":"No past visits yet."
    ));
    return;
  }

  shown.forEach(b=>{
    const c=txt("article","booking-item","");
    c.appendChild(txt("h4","",b.temple_name||"Temple"));
    c.appendChild(txt("p","",`⌖ ${b.temple_city||"City not listed"} · ${b.booking_date}`));
    c.appendChild(txt("p","",`◷ ${formatSlot(b.slot_start,b.slot_end)}`));
    c.appendChild(txt("p","",`Reference: ${b.booking_ref}`));
    c.appendChild(txt("p","",`Devotees: ${b.devotee_count}`));
    c.appendChild(txt("span","status-pill",b.status||"Unknown"));

    const pass={
      temple_name:b.temple_name,
      temple_city:b.temple_city,
      devotee_name:$("devoteeName").textContent,
      devotee_count:b.devotee_count,
      darshan_date:b.booking_date,
      time_slot:formatSlot(b.slot_start,b.slot_end),
      booking_token:b.booking_ref
    };

    const view=txt("button","small-action","View E-Pass");
    view.type="button";
    view.addEventListener("click",()=>{
      renderPass(pass);
      openModal("bookingModal");
    });
    c.appendChild(view);

    const openHostedPass=txt("button","small-action","Open Full Pass");
    openHostedPass.type="button";
    openHostedPass.addEventListener("click",()=>{
      const bookingToken=b.booking_ref;

      if(!bookingToken) {
        showToast("This booking has no reference token.");
        return;
      }

      window.open(getHostedPassUrl(bookingToken), "_blank", "noopener");
    });
    c.appendChild(openHostedPass);

    if(st(b.status)==="confirmed"&&b.booking_date>=today) {
      const cancel=txt("button","small-action","Cancel Booking");
      cancel.type="button";

      cancel.addEventListener("click",async()=>{
        if(!confirm("Cancel this booking?")) return;

        cancel.disabled=true;

        try {
          const {error}=await sb.rpc(
            "cancel_darshan_booking",
            {p_booking_id:b.id}
          );

          if(error) throw error;

          showToast("Booking cancelled. Places are available again.");
          await loadBookings();

        } catch(e) {
          console.error("Cancellation:",e);
          showToast(e.message||"Cancellation failed.");
          cancel.disabled=false;
        }
      });

      c.appendChild(cancel);
    }

    list.appendChild(c);
  });
}

/* --------------------------------------------------
   EXISTING SERVICE WINDOWS
-------------------------------------------------- */

function openService(title,subtitle,icon) {
  $("serviceTitle").textContent=title;
  $("serviceSubtitle").textContent=subtitle;
  $("serviceIcon").textContent=icon;
  $("serviceContent").replaceChildren();
  openModal("serviceModal");
}

function serviceForm() {
  const f=document.createElement("form");
  f.className="service-form";
  $("serviceContent").appendChild(f);
  return f;
}

function serviceButton(f,label) {
  const b=txt("button","primary",label);
  b.type="submit";
  f.appendChild(b);
  return b;
}

function renderServiceRecords(key) {
  const c=txt("div","service-results","");
  readLocal(key).forEach(r=>{
    const a=txt("article","result-card","");
    a.appendChild(txt("h4","",`${r.title||r.type||r.slot||"Report"} · ${r.id}`));
    a.appendChild(txt("p","",r.details||""));
    a.appendChild(txt("p","",`${r.createdAt} · ${r.status}`));
    c.appendChild(a);
  });
  $("serviceContent").appendChild(c);
}

function saveServiceRecord(key,r) {
  const a=readLocal(key);
  a.unshift(r);
  return saveLocal(key,a);
}

function openSOS() {
  openService("Emergency SOS Assistance","Emergency assistance request","⚠");
  const f=serviceForm();

  addSelect(f,"CURRENT TEMPLE ZONE","sosZone",[
    ["Sanctum Sanctorum","Sanctum Sanctorum (Main Darshan Zone)"],
    ["Main Darshan Corridor","Main Darshan Corridor"],
    ["North Entrance Gate","North Entrance Gate"],
    ["Vehicle Parking Ground","Vehicle Parking Ground"],
    ["Shoe Stand","Shoe Stand & Footwear Counter"],
    ["Prasadam Hall","Prasadam & Dining Hall"]
  ]);

  addSelect(f,"EMERGENCY TYPE","sosType",[
    ["Medical / Fainting","🚑 Medical / Fainting"],
    ["Crowd Surge / Crush","⚠ Crowd Surge / Crush"],
    ["Lost Child / Missing","👶 Lost Child / Missing"],
    ["Elderly Assistance","🦽 Elderly Assistance"],
    ["Fire / Smoke Hazard","🧯 Fire / Smoke Hazard"],
    ["Security / Theft","🛡 Security / Theft"]
  ]);

  addField(f,"CONTACT MOBILE (OPTIONAL)","sosMobile","tel","10-digit mobile number");

  f.appendChild(txt(
    "p",
    "notice",
    "This project form does not alert emergency services. In an emergency in India, call 112."
  ));

  serviceButton(f,"Record SOS Request");

  f.addEventListener("submit",e=>{
    e.preventDefault();

    const m=$("sosMobile").value.trim();

    if(m&&!/^[0-9]{10}$/.test(m)) {
      showToast("Enter a valid 10-digit mobile number.");
      return;
    }

    const r={
      id:token("SOS"),
      type:$("sosType").value,
      details:`Zone: ${$("sosZone").value}; contact: ${m||"not provided"}`,
      createdAt:new Date().toLocaleString(),
      status:"Recorded in this browser"
    };

    if(saveServiceRecord("stcm_sos",r)) showToast(`SOS request recorded: ${r.id}`);
  });

  renderServiceRecords("stcm_sos");
}

function openDonation() {
  openService("Temple Daan & E-Hundi","Donation presentation and receipt","♥");

  const f=serviceForm();
  const opts=temples.map(t=>[
    t.name,
    `${t.name}${t.city?" ("+t.city+")":""}`
  ]);

  addSelect(
    f,
    "SELECT TEMPLE TRUST",
    "donTemple",
    opts.length?opts:[["General Temple Trust","General Temple Trust"]]
  );

  addField(f,"DEVOTEE NAME","donName","text","Your name").value=$("devoteeName").textContent;

  addSelect(f,"SEVA / PURPOSE","donPurpose",[
    ["General Temple Trust Fund","General Temple Trust Fund"],
    ["Annadaan Mahaprasad Seva","Annadaan Mahaprasad Seva"],
    ["Goshala Seva - Cow Care","Goshala Seva - Cow Care"],
    ["Special Puja & Deepam","Special Puja & Deepam"],
    ["Mandir Renovation & Development","Mandir Renovation & Development"]
  ]);

  addSelect(f,"SELECT DAAN OFFERING (₹)","donAmount",[
    ["51","₹51"],["101","₹101"],["251","₹251"],
    ["501","₹501"],["1100","₹1100"],["2100","₹2100"]
  ]);

  f.appendChild(txt(
    "p",
    "notice",
    "Presentation flow only. No money will be collected. Receipt is not proof of payment or tax eligibility."
  ));

  serviceButton(f,"Create Presentation Receipt");

  f.addEventListener("submit",e=>{
    e.preventDefault();

    const r={
      id:token("RCPT"),
      title:$("donTemple").value,
      details:`Devotee: ${$("donName").value}; purpose: ${$("donPurpose").value}; amount ₹${$("donAmount").value}`,
      createdAt:new Date().toLocaleString(),
      status:"Presentation receipt — unpaid"
    };

    if(!saveServiceRecord("stcm_donations",r)) return;

    const a=txt("div","result-card","");
    a.appendChild(txt("h3","","Donation Receipt"));
    a.appendChild(txt("p","",`Receipt number: ${r.id}`));
    a.appendChild(txt("p","",r.title));
    a.appendChild(txt("p","",r.details));
    a.appendChild(txt("p","",r.status));
    $("serviceContent").appendChild(a);

    addButton($("serviceContent"),"Print Receipt",()=>window.print(),"secondary");
  });

  renderServiceRecords("stcm_donations");
}

const parkingConfig={
  A:{name:"Zone A · North Gate",prefix:"A",total:16,occupied:[2,3,6,8,11,14,15]},
  B:{name:"Zone B · East Gate",prefix:"B",total:16,occupied:[1,5,7,10,12]},
  C:{name:"Zone C · Sanctum Gate",prefix:"C",total:8,occupied:[2,6]}
};

function openParking() {
  openService("Smart Parking & Slot Reservation","Choose an available bay","♧");

  const host=$("serviceContent");
  const zones=txt("div","slot-zones","");

  Object.keys(parkingConfig).forEach(z=>{
    const b=txt("button","zone-btn",parkingConfig[z].name);
    b.type="button";
    b.classList.toggle("active",z===selectedZone);
    b.addEventListener("click",()=>{
      selectedZone=z;
      openParking();
    });
    zones.appendChild(b);
  });

  host.appendChild(zones);
  host.appendChild(txt(
    "p",
    "notice",
    `${parkingConfig[selectedZone].name}. Green bays are available; red bays are occupied in this sample layout.`
  ));

  const slots=txt("div","parking-slots","");
  host.appendChild(slots);

  const saved=readLocal("stcm_parking");

  for(let i=1;i<=parkingConfig[selectedZone].total;i++) {
    const id=`${parkingConfig[selectedZone].prefix}-${String(i).padStart(2,"0")}`;

    const occupied=parkingConfig[selectedZone].occupied.includes(i)||
      saved.some(r=>r.slot===id&&r.zone===selectedZone);

    const b=txt("button",`parking-slot${occupied?" occupied":""}`,id);
    b.type="button";
    b.disabled=occupied;
    b.appendChild(txt("small","",occupied?"OCCUPIED":"AVAILABLE"));

    b.addEventListener("click",()=>{
      selectedSlot=id;
      document.querySelectorAll(".parking-slot").forEach(x=>x.classList.remove("selected"));
      b.classList.add("selected");
    });

    slots.appendChild(b);
  }

  const f=serviceForm();

  addField(f,"VEHICLE NUMBER PLATE","parkPlate","text","e.g. MH 02 CZ 4589");
  addSelect(f,"VEHICLE CATEGORY","parkCategory",[
    ["4-Wheeler","4-Wheeler"],
    ["2-Wheeler","2-Wheeler"],
    ["Accessible / VIP","Accessible / VIP"]
  ]);

  addField(f,"DRIVER / DEVOTEE NAME","parkName","text","Driver name").value=$("devoteeName").textContent;
  addField(f,"CONTACT MOBILE (OPTIONAL)","parkMobile","tel","10-digit mobile number");
  serviceButton(f,"Confirm & Reserve Slot");

  f.addEventListener("submit",e=>{
    e.preventDefault();

    if(!selectedSlot) {
      showToast("Select an available slot first.");
      return;
    }

    const plate=$("parkPlate").value.trim().toUpperCase();
    const name=$("parkName").value.trim();
    const m=$("parkMobile").value.trim();

    if(!plate||!name) {
      showToast("Enter vehicle number and driver name.");
      return;
    }

    if(m&&!/^[0-9]{10}$/.test(m)) {
      showToast("Enter a valid 10-digit mobile number.");
      return;
    }

    const r={
      id:token("PK"),
      slot:selectedSlot,
      zone:selectedZone,
      title:selectedSlot,
      details:`${plate} · ${name} · ${parkingConfig[selectedZone].name}`,
      createdAt:new Date().toLocaleString(),
      status:"Browser reservation"
    };

    if(saveServiceRecord("stcm_parking",r)) {
      showToast(`Demo parking reservation recorded: ${r.slot}`);
      selectedSlot="";
      openParking();
    }
  });

  renderServiceRecords("stcm_parking");
}

function openLost() {
  openService("AI Lost & Found / Missing Help","Submit and track a missing-person or missing-item report","⌕");

  const f=serviceForm();

  addSelect(f,"CATEGORY","lostCategory",[
    ["Lost Child","Lost Child"],
    ["Missing Person","Missing Person"],
    ["Lost Item","Lost Item"],
    ["Missing Bag / Item","Missing Bag / Item"]
  ]);

  addSelect(f,"LAST SEEN ZONE","lostZone",[
    ["Sanctum Sanctorum","Sanctum Sanctorum"],
    ["Main Darshan Corridor","Main Darshan Corridor"],
    ["North Entrance Gate","North Entrance Gate"],
    ["Vehicle Parking Ground","Vehicle Parking Ground"],
    ["Shoe Stand","Shoe Stand"],
    ["Prasadam Hall","Prasadam & Dining Hall"]
  ]);

  addField(f,"VISUAL DESCRIPTION","lostDescription","textarea","Describe clothing, colour, identifying marks or item details");
  addField(f,"CONTACT PERSON / GUARDIAN","lostContact","text","Contact person's name");
  addField(f,"CONTACT MOBILE (OPTIONAL)","lostMobile","tel","10-digit mobile number");

  const photo=addField(f,"REFERENCE PHOTO (OPTIONAL)","lostPhoto","file","");
  photo.accept="image/*";

  f.appendChild(txt(
    "p",
    "notice",
    "This form does not connect to CCTV, facial recognition or temple security. Contact temple staff directly for urgent help."
  ));

  serviceButton(f,"Submit Missing Report");

  f.addEventListener("submit",e=>{
    e.preventDefault();

    const m=$("lostMobile").value.trim();

    if(!$("lostDescription").value.trim()) {
      showToast("Enter a description.");
      return;
    }

    if(m&&!/^[0-9]{10}$/.test(m)) {
      showToast("Enter a valid 10-digit mobile number.");
      return;
    }

    const r={
      id:token("LF"),
      title:$("lostCategory").value,
      details:`Zone: ${$("lostZone").value}; ${$("lostDescription").value.trim()}; contact: ${$("lostContact").value.trim()||"not provided"}; photo: ${$("lostPhoto").files[0]?.name||"none"}`,
      createdAt:new Date().toLocaleString(),
      status:"Report received locally"
    };

    if(saveServiceRecord("stcm_lost",r)) showToast(`Report recorded: ${r.id}`);
  });

  renderServiceRecords("stcm_lost");
}

/* --------------------------------------------------
   EVENT LISTENERS
-------------------------------------------------- */

function bindEvents() {
  $("templeSearch").addEventListener("input",renderTemples);
  $("cityFilter").addEventListener("change",renderTemples);
  $("bookingForm").addEventListener("submit",createBooking);
  $("bookingTemple").addEventListener("change",loadAvailableSlots);
  $("bookingDate").addEventListener("change",loadAvailableSlots);

  // Print / Save opens the full hosted pass page, not the dashboard modal.
  $("printPass").addEventListener("click",()=>{
    if(!currentPassToken) {
      showToast("Open a booking's E-Pass first.");
      return;
    }

    const passUrl=getHostedPassUrl(currentPassToken,true);
    window.open(passUrl,"_blank","noopener");
  });

  $("newBooking").addEventListener("click",()=>closeModal("bookingModal"));

  document.querySelectorAll("[data-close]").forEach(b=>
    b.addEventListener("click",()=>closeModal(b.dataset.close))
  );

  document.querySelectorAll(".overlay").forEach(m=>
    m.addEventListener("click",e=>{
      if(e.target===m) closeModal(m);
    })
  );

  document.addEventListener("keydown",e=>{
    if(e.key==="Escape") {
      document.querySelectorAll(".overlay.open").forEach(closeModal);
    }
  });

  document.querySelectorAll(".tab").forEach(b=>
    b.addEventListener("click",()=>{
      currentTab=b.dataset.tab;
      document.querySelectorAll(".tab").forEach(t=>
        t.classList.toggle("active",t===b)
      );
      renderBookings();
    })
  );

  document.querySelectorAll("[data-service]").forEach(b=>
    b.addEventListener("click",()=>
      ({sos:openSOS,donation:openDonation,parking:openParking,lost:openLost})[b.dataset.service]()
    )
  );

  document.querySelectorAll(".lang").forEach(b=>
    b.addEventListener("click",()=>{
      document.querySelectorAll(".lang").forEach(x=>
        x.classList.toggle("active",x===b)
      );
      showToast(
        b.dataset.lang==="hi"
          ?"हिन्दी चयनित — कुछ पृष्ठ अभी अंग्रेज़ी में हैं।"
          :"English selected."
      );
    })
  );

  $("logoutBtn").addEventListener("click",async()=>{
    $("logoutBtn").disabled=true;
    const {error}=await sb.auth.signOut();

    if(error) {
      $("logoutBtn").disabled=false;
      showToast("Logout failed.");
      return;
    }

    location.replace("./login.html");
  });
}

init();
