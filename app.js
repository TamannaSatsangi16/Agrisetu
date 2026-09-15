const app = document.getElementById("app");

const state = {
  page: "landing",
  role: "Farmer",
  user: localStorage.getItem("agrisetuUser") || "",
  loggedIn: sessionStorage.getItem("agrisetuSession") === "true",
  bookingStep: 1,
  selectedStorage: null,
  selectedPorter: null,
  paymentDone: false,
  paymentMethod: "UPI",
  selectedMonitorStorageId: "",
  monitorHistory: {}
};
if(state.user) state.role=localStorage.getItem("agrisetuRole_"+state.user)||"Farmer";

const storageOptions = [
  {name:"Agra Cold Storage", location:"Agra", distance:"12 km", available:"15,500 kg", price:2.5, cost:7500},
  {name:"Green Fresh Storage", location:"Mathura", distance:"28 km", available:"12,000 kg", price:3, cost:9000},
  {name:"Yamuna Cold Chain", location:"Firozabad", distance:"45 km", available:"4,500 kg", price:2.2, cost:6600}
];
const porterOptions = [
  {name:"Porter A - Ramesh", type:"Mini Truck", eta:"25 min", distance:"8 km", price:650},
  {name:"Porter B - Suresh", type:"Pickup", eta:"40 min", distance:"14 km", price:480},
  {name:"Porter C - Mahesh", type:"Tempo", eta:"65 min", distance:"30 km", price:1200}
];

function userKey(){ return (state.user || "guest").toLowerCase().replace(/[^a-z0-9]/g,"_"); }
function key(name){ return `agrisetu_${name}_${userKey()}`; }
function keyForUser(name,email){ return `agrisetu_${name}_${(email||"guest").toLowerCase().replace(/[^a-z0-9]/g,"_")}`; }
function normalizeName(v){ return String(v||"").trim().toLowerCase().replace(/\s+/g," "); }
function globalBookings(){ try{return JSON.parse(localStorage.getItem("agrisetu_bookings_global")||"[]");}catch{return [];} }
function writeGlobalBookings(value){ localStorage.setItem("agrisetu_bookings_global",JSON.stringify(value)); }
function accountData(email){ try{return JSON.parse(localStorage.getItem(`agrisetuAccount_${email}`)||"{}");}catch{return {}; } }
function notifyMatchingColdStorages(booking){
  const msg=`${booking.farmerName||booking.farmerUser} requested ${Number(booking.quantity).toLocaleString()} kg of ${booking.product} at ${booking.storage}.`;
  for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i)||""; if(!k.startsWith("agrisetuAccount_"))continue; const email=k.slice("agrisetuAccount_".length); const a=accountData(email); if(a.role==="Cold Storage" && normalizeName(a.storageName||a.name)===normalizeName(booking.storage)){ const ns=JSON.parse(localStorage.getItem(keyForUser("notifications",email))||"[]"); ns.unshift({id:uid("NTF"),title:"New booking request",message:msg,type:"info",createdAt:Date.now()}); localStorage.setItem(keyForUser("notifications",email),JSON.stringify(ns.slice(0,50))); } }
}
function currentAccount(){ return accountData(state.user); }
function coldStorageName(){ const a=currentAccount(); return a.storageName || a.name || ""; }

function readStore(name, fallback){ try{return JSON.parse(localStorage.getItem(key(name)) || JSON.stringify(fallback));}catch{return fallback;} }
function writeStore(name, value){ localStorage.setItem(key(name), JSON.stringify(value)); }
function isAcceptedBooking(b){ return !!b && (b.storageAccepted===true || b.status==="ACCEPTED" || b.status==="STORED" || b.status==="Completed"); }
function acceptedProducts(){
  const products=readStore("products",[]), bookings=readStore("bookings",[]);
  const acceptedBatchIds=new Set(bookings.filter(isAcceptedBooking).map(b=>b.batchId));
  return products.filter(p=>p.storage && (p.storageAccepted===true || acceptedBatchIds.has(p.batchId)));
}
function globalMarketplace(){
  try{return JSON.parse(localStorage.getItem("agrisetu_marketplace_global")||"[]");}catch{return [];}
}
function writeGlobalMarketplace(value){localStorage.setItem("agrisetu_marketplace_global",JSON.stringify(value));}
function migrateMarketplace(){
  const mine=readStore("marketplace",[]);
  const global=globalMarketplace();
  if(mine.length){
    const ids=new Set(global.map(x=>x.id));
    mine.forEach(l=>{if(!ids.has(l.id))global.push({...l,seller:state.user||"",sellerRole:"Farmer"});});
    writeGlobalMarketplace(global);
    writeStore("marketplace",[]);
  }
}
function sensorSnapshot(batchId){
  const t=4.5 + Math.random()*2.8, h=78 + Math.random()*14, co2=Math.round(650+Math.random()*650);
  return {temperature:Number(t.toFixed(1)),humidity:Math.round(h),co2};
}
function uid(prefix){ return `${prefix}-${Date.now()}-${Math.floor(Math.random()*900+100)}`; }
function icon(x){ return `<span>${x}</span>`; }

function seedUserData(){
  if(!state.user) return;
  if(!localStorage.getItem(key("notifications"))) writeStore("notifications", []);
  if(!localStorage.getItem(key("payments"))) writeStore("payments", []);
  if(!localStorage.getItem(key("products"))) writeStore("products", []);
  if(!localStorage.getItem(key("marketplace"))) writeStore("marketplace", []);
  if(!localStorage.getItem(key("discounts"))) writeStore("discounts", []);
  if(!localStorage.getItem(key("alerts"))) writeStore("alerts", []);
}

function addNotification(title, message, type="info", toast=true){
  if(!state.user) return;
  const notifications=readStore("notifications",[]);
  const n={id:uid("NTF"),title,message,type,createdAt:Date.now()};
  notifications.unshift(n); writeStore("notifications",notifications.slice(0,50));
  if(toast) showToast(n);
  renderNotificationBadge();
}
function showToast(n){
  let stack=document.getElementById("toastStack");
  if(!stack){ stack=document.createElement("div"); stack.id="toastStack"; stack.className="toast-stack"; document.body.appendChild(stack); }
  const toast=document.createElement("div"); toast.className=`toast ${n.type||"info"}`;
  toast.innerHTML=`<button class="toast-close" onclick="this.parentElement.remove()">×</button><b>${escapeHtml(n.title)}</b><span>${escapeHtml(n.message)}</span>`;
  stack.appendChild(toast);
  setTimeout(()=>{toast.classList.add("hide");setTimeout(()=>toast.remove(),300)},5000);
}
function renderNotificationBadge(){
  const badge=document.querySelector(".notif-badge");
  if(!badge) return;
  const count=readStore("notifications",[]).length;
  badge.textContent=count>99?"99+":count;
  badge.style.display=count?"block":"none";
}

function landing(){
  return `
  <div class="landing">
    <nav class="topnav">
      <div class="brand"><img src="assets/logo.png"><span>Agrisetu</span></div>
      <div class="navlinks"><a href="#how">How it works</a><a href="#features">Features</a><a href="#roles">Roles</a></div>
      <div class="nav-actions"><button class="btn btn-outline" onclick="showLogin()">Login</button><button class="btn btn-primary" onclick="showLogin()">Get Started</button></div>
    </nav>
    <section class="hero">
      <div class="badge">🌿 AgriTech + Logistics Platform</div>
      <h1>Smart Cold Storage.<br><span>Smarter Agriculture.</span></h1>
      <p>Connect farmers, cold storages, transport partners and buyers through one intelligent agricultural supply-chain platform.</p>
      <div class="hero-buttons"><button class="btn btn-primary" onclick="showLogin()">Login →</button><button class="btn btn-outline" onclick="showLogin()">Get Started</button></div>
      <div class="check-row"><span class="check">✓ OTP-secured</span><span class="check">✓ Real-time monitoring</span><span class="check">✓ AI spoilage alerts</span></div>
    </section>
    <section class="stats" id="features"><div class="stat"><div class="icon">🌱</div><b>1,240+</b><span>Farmers</span></div><div class="stat"><div class="icon">❄️</div><b>86</b><span>Cold Storages</span></div><div class="stat"><div class="icon">🚚</div><b>312</b><span>Active Trips</span></div><div class="stat"><div class="icon">🛒</div><b>540+</b><span>Buyers</span></div></section>
    <div class="supply" id="how"><div class="supply-title"><span>Live Supply Chain</span><span style="color:#12a75a">● Active</span></div><div class="supply-line"><div class="supply-node">🌱<small>Farmer</small></div><div class="line"></div><div class="supply-node">⚯<small>Porter</small></div><div class="line"></div><div class="supply-node">❄️<small>Storage</small></div><div class="line"></div><div class="supply-node">🛒<small>Buyer</small></div></div></div>
  </div>`;
}

function login(){
  return `<div class="login-wrap"><div class="login-card"><div class="login-logo"><img src="assets/logo.png"><h1>Agrisetu</h1><p>Bridging Farmers to a Fresher Tomorrow</p></div>${state.user?`<div style="background:#eef9f2;padding:12px;border-radius:10px;color:#176e3d">Returning user: <b>${escapeHtml(state.user)}</b></div>`:""}<div id="loginError"></div><div style="margin-top:25px"><div class="field"><label>Email</label><input id="email" type="email" placeholder="Enter your email" value="${escapeAttr(state.user)}"></div><div class="field" style="margin-top:18px"><label>Password</label><input id="password" type="password" placeholder="${state.user?"Enter your saved password":"Create a password"}"></div><div style="margin:22px 0 10px;font-weight:600">Login as</div><div class="role-grid">${["Farmer","Cold Storage","Porter","Buyer"].map(r=>`<button class="role ${state.role===r?"selected":""}" onclick="selectRole('${r}')">◯ &nbsp;${r}</button>`).join("")}</div><button class="btn btn-primary login-submit" onclick="doLogin()">Log in</button><button class="btn btn-outline login-submit" onclick="state.page='landing';render()">← Back to landing page</button><div class="register-prompt">Don't have an account? <button type="button" onclick="showRegister()">Create one</button></div></div></div></div>`;
}

function registerPage(){
  return `<div class="login-wrap"><div class="login-card"><div class="login-logo"><img src="assets/logo.png"><h1>Agrisetu</h1><p>Bridging Farmers to a Fresher Tomorrow</p></div><div id="registerError"></div><div style="margin-top:25px"><div class="field"><label>Full Name</label><input id="registerName" type="text" placeholder="Enter your name"></div><div class="field" style="margin-top:18px"><label>Phone Number</label><input id="registerPhone" type="tel" placeholder="Enter your phone number"></div><div class="field" style="margin-top:18px"><label>Email</label><input id="registerEmail" type="email" placeholder="Enter your email"></div><div class="field" style="margin-top:18px"><label>Password</label><input id="registerPassword" type="password" placeholder="Create a password"></div><div class="field" style="margin-top:18px"><label>Confirm Password</label><input id="registerConfirm" type="password" placeholder="Confirm your password"></div><div style="margin:22px 0 10px;font-weight:600">Register as</div><div class="role-grid">${["Farmer","Cold Storage","Porter","Buyer"].map(r=>`<button class="role ${state.role===r?"selected":""}" onclick="selectRegisterRole('${r}')">◯ &nbsp;${r}</button>`).join("")}</div>${state.role==="Cold Storage"?`<div class="field" style="margin-top:18px"><label>Cold Storage Name</label><select id="registerStorageName"><option value="">Select your cold storage</option>${storageOptions.map(s=>`<option value="${escapeAttr(s.name)}">${escapeHtml(s.name)}</option>`).join("")}</select><small style="display:block;margin-top:8px;color:var(--muted)">Select the same storage name that farmers use when booking.</small></div>`:""}<button class="btn btn-primary login-submit" onclick="doRegister()">Create account</button><button class="btn btn-outline login-submit" onclick="showLogin()">← Back to login</button></div></div></div>`;
}

function shell(content){
  const isCold=state.role==="Cold Storage";
  const isPorter=state.role==="Porter";
  const isBuyer=state.role==="Buyer";
  const items=isCold
    ? [["dashboard","▦","Dashboard"],["requests","▱","Booking Requests"],["incoming","◇","Incoming Stock"],["stored","▤","Stored Stock"],["price","◇","Price Listing"],["monitor","♧","Monitoring"],["notifications","♧","Notifications"],["profile","♙","Profile"]]
    : isPorter
    ? [["dashboard","▦","Dashboard"],["notifications","♧","Notifications"],["profile","♙","Profile"]]
    : isBuyer
    ? [["dashboard","▦","Dashboard"],["market","▣","Marketplace"],["notifications","♧","Notifications"],["profile","♙","Profile"]]
    : [["dashboard","▦","Dashboard"],["book","▤","Book Storage"],["storage","♧","My Storage"],["products","◇","My Products"],["market","▣","Marketplace"],["monitor","♧","Monitoring"],["alerts","⚠","Spoilage Alerts"],["discounts","◇","Discounts"],["payments","▭","Payments"],["invoices","▤","Invoices"],["notifications","♧","Notifications"],["profile","♙","Profile"]];
  const displayName=currentAccount().name||state.user||"User";
  const portalLabel=isCold?"Cold Storage":isPorter?"Porter":isBuyer?"Buyer":"Farmer";
  return `<div class="app-shell"><div class="sidebar-overlay" id="sidebarOverlay" onclick="toggleSidebar()"></div><aside class="sidebar" id="sidebar"><div class="side-brand"><img src="assets/logo.png"><div><div class="title">Agrisetu</div><div class="sub">${escapeHtml(isCold?(coldStorageName()||"Cold Storage"):portalLabel)} Portal</div></div><button class="close-side" onclick="toggleSidebar()">×</button></div><div class="menu">${items.map(([pg,i,l])=>`<button class="menu-item ${state.page===pg?'active':''}" onclick="navigate('${pg}')"><span class="menu-icon">${i}</span>${t(l)}${pg==='notifications'&&readStore('notifications',[]).length?`<span class="menu-count">${Math.min(readStore('notifications',[]).length,99)}</span>`:""}</button>`).join("")}</div><button class="back-landing" onclick="logout()">◎ &nbsp; Back to landing page</button></aside><main class="main"><header class="app-top"><button class="hamb" onclick="toggleSidebar()">☰</button><div><div class="top-title">${t(pageTitle())}</div><div class="top-sub">${t(portalLabel)} · ${t("ColdChain Network")}</div></div><div class="spacer"></div><div class="top-actions"><div class="language-wrap"><button class="language-btn" onclick="toggleLanguageMenu(event)" aria-label="Select language"><span>◎</span> <span id="current-language">${getLanguageLabel()}</span><span class="language-chevron">⌄</span></button><div id="language-menu" class="language-menu" onclick="event.stopPropagation()"><button onclick="selectLanguage('English','EN')">English</button><button onclick="selectLanguage('Hindi','हिन्दी')">हिन्दी</button><button onclick="selectLanguage('Marathi','मराठी')">मराठी</button><button onclick="selectLanguage('Telugu','తెలుగు')">తెలుగు</button><button onclick="selectLanguage('Punjabi','ਪੰਜਾਬੀ')">ਪੰਜਾਬੀ</button></div></div><span>♙ ${escapeHtml(portalLabel)}</span><button class="top-notif" onclick="navigate('notifications')"><span class="notif">♧<i class="notif-badge">0</i></span></button><span class="avatar">${escapeHtml((displayName||"U").slice(0,2).toUpperCase())}</span></div></header><div class="content">${content}</div></main></div>`;
}
const translations={
  English:{},
  Hindi:{Dashboard:"डैशबोर्ड",Monitoring:"निगरानी",Storage:"भंडारण",Products:"उत्पाद",Marketplace:"मार्केटप्लेस", "Spoilage Alerts":"खराब होने के अलर्ट",Discounts:"छूट",Payments:"भुगतान",Invoices:"चालान",Notifications:"सूचनाएँ","Book Storage":"स्टोरेज बुक करें","My Storage":"मेरा भंडारण","My Products":"मेरे उत्पाद","Farmer":"किसान","ColdChain Network":"कोल्डचेन नेटवर्क","Storage Monitoring":"स्टोरेज निगरानी","Live Monitoring":"लाइव निगरानी","Temperature":"तापमान","Humidity":"नमी","NDIR CO₂":"NDIR CO₂","Camera feed":"कैमरा फ़ीड","Accepted & Stored":"स्वीकृत और संग्रहीत","View Live Monitoring":"लाइव निगरानी देखें","Select Cold Storage":"कोल्ड स्टोरेज चुनें","Live":"लाइव","Older":"पुराना","Nothing to monitor":"निगरानी के लिए कुछ नहीं","View My Storage":"मेरा भंडारण देखें"},
  Marathi:{Dashboard:"डॅशबोर्ड",Monitoring:"निगराणी",Storage:"साठवण",Products:"उत्पादने",Marketplace:"मार्केटप्लेस", "Spoilage Alerts":"खराब होण्याचे अलर्ट",Discounts:"सवलत",Payments:"पेमेंट्स",Invoices:"पावत्या",Notifications:"सूचना","Book Storage":"स्टोरेज बुक करा","My Storage":"माझी साठवण","My Products":"माझी उत्पादने","Farmer":"शेतकरी","ColdChain Network":"कोल्डचेन नेटवर्क","Storage Monitoring":"स्टोरेज निगराणी","Live Monitoring":"लाइव्ह निगराणी","Temperature":"तापमान","Humidity":"आर्द्रता","NDIR CO₂":"NDIR CO₂","Camera feed":"कॅमेरा फीड","Accepted & Stored":"स्वीकृत आणि साठवलेले","View Live Monitoring":"लाइव्ह निगराणी पहा","Select Cold Storage":"कोल्ड स्टोरेज निवडा","Live":"लाइव्ह","Older":"जुने","Nothing to monitor":"निगराणीसाठी काहीही नाही","View My Storage":"माझी साठवण पहा"},
  Telugu:{Dashboard:"డాష్‌బోర్డ్",Monitoring:"పర్యవేక్షణ",Storage:"నిల్వ",Products:"ఉత్పత్తులు",Marketplace:"మార్కెట్‌ప్లేస్", "Spoilage Alerts":"పాడైపోయే హెచ్చరికలు",Discounts:"డిస్కౌంట్లు",Payments:"చెల్లింపులు",Invoices:"ఇన్వాయిసులు",Notifications:"నోటిఫికేషన్లు","Book Storage":"స్టోరేజ్ బుక్ చేయండి","My Storage":"నా నిల్వ","My Products":"నా ఉత్పత్తులు","Farmer":"రైతు","ColdChain Network":"కోల్డ్‌చైన్ నెట్‌వర్క్","Storage Monitoring":"స్టోరేజ్ పర్యవేక్షణ","Live Monitoring":"లైవ్ పర్యవేక్షణ","Temperature":"ఉష్ణోగ్రత","Humidity":"తేమ","NDIR CO₂":"NDIR CO₂","Camera feed":"కెమెరా ఫీడ్","Accepted & Stored":"ఆమోదించబడింది & నిల్వ చేయబడింది","View Live Monitoring":"లైవ్ పర్యవేక్షణ చూడండి","Select Cold Storage":"కోల్డ్ స్టోరేజ్ ఎంచుకోండి","Live":"లైవ్","Older":"పాతవి","Nothing to monitor":"పర్యవేక్షించడానికి ఏమీ లేదు","View My Storage":"నా నిల్వను చూడండి"},
  Punjabi:{Dashboard:"ਡੈਸ਼ਬੋਰਡ",Monitoring:"ਨਿਗਰਾਨੀ",Storage:"ਸਟੋਰੇਜ",Products:"ਉਤਪਾਦ",Marketplace:"ਮਾਰਕੀਟਪਲੇਸ", "Spoilage Alerts":"ਖਰਾਬੀ ਦੇ ਅਲਰਟ",Discounts:"ਛੂਟ",Payments:"ਭੁਗਤਾਨ",Invoices:"ਇਨਵੌਇਸ",Notifications:"ਸੂਚਨਾਵਾਂ","Book Storage":"ਸਟੋਰੇਜ ਬੁੱਕ ਕਰੋ","My Storage":"ਮੇਰੀ ਸਟੋਰੇਜ","My Products":"ਮੇਰੇ ਉਤਪਾਦ","Farmer":"ਕਿਸਾਨ","ColdChain Network":"ਕੋਲਡਚੇਨ ਨੈੱਟਵਰਕ","Storage Monitoring":"ਸਟੋਰੇਜ ਨਿਗਰਾਨੀ","Live Monitoring":"ਲਾਈਵ ਨਿਗਰਾਨੀ","Temperature":"ਤਾਪਮਾਨ","Humidity":"ਨਮੀ","NDIR CO₂":"NDIR CO₂","Camera feed":"ਕੈਮਰਾ ਫੀਡ","Accepted & Stored":"ਮਨਜ਼ੂਰ ਅਤੇ ਸਟੋਰ ਕੀਤਾ","View Live Monitoring":"ਲਾਈਵ ਨਿਗਰਾਨੀ ਵੇਖੋ","Select Cold Storage":"ਕੋਲਡ ਸਟੋਰੇਜ ਚੁਣੋ","Live":"ਲਾਈਵ","Older":"ਪੁਰਾਣਾ","Nothing to monitor":"ਨਿਗਰਾਨੀ ਲਈ ਕੁਝ ਨਹੀਂ","View My Storage":"ਮੇਰੀ ਸਟੋਰੇਜ ਵੇਖੋ"}
};

// Full UI translations for the static labels and booking/monitoring screens.
// The app is rendered from JavaScript, so these strings are translated after each render.
const uiTranslations={
  Hindi:{
    "Details":"विवरण","Storage":"भंडारण","Travel":"यात्रा","Product + OTP":"उत्पाद + OTP","Payment":"भुगतान",
    "Select Travel Partner":"यात्रा पार्टनर चुनें","Back":"वापस","Continue":"जारी रखें","Generate OTP":"OTP जनरेट करें","Proceed to Payment":"भुगतान के लिए आगे बढ़ें",
    "Book Cold Storage Slot":"कोल्ड स्टोरेज स्लॉट बुक करें","Book storage, assign travel, generate pickup OTP and pay.":"स्टोरेज बुक करें, यात्रा पार्टनर चुनें, पिकअप OTP जनरेट करें और भुगतान करें।",
    "Booking Details":"बुकिंग विवरण","Product":"उत्पाद","Quantity (kg)":"मात्रा (किग्रा)","Storage Duration (months)":"भंडारण अवधि (महीने)","Preferred Date":"पसंदीदा तारीख","Pickup Location":"पिकअप स्थान",
    "Select Cold Storage":"कोल्ड स्टोरेज चुनें","Sort: Distance":"क्रम: दूरी","Sort: Price":"क्रम: कीमत","Available":"उपलब्ध","Price":"कीमत","Est. cost":"अनुमानित लागत",
    "Payment Method":"भुगतान विधि","Storage Charges":"भंडारण शुल्क","Transportation Charges":"परिवहन शुल्क","Total Amount":"कुल राशि","Pay":"भुगतान करें","Payment Successful":"भुगतान सफल","Your payment has been processed.":"आपका भुगतान सफलतापूर्वक संसाधित हो गया है।","Done":"हो गया",
    "Select Travel Partner":"यात्रा पार्टनर चुनें","Pickup OTP":"पिकअप OTP","Share this OTP with the assigned Porter only when your stock is ready for pickup.":"यह OTP केवल निर्धारित पोर्टर के साथ तब साझा करें जब आपका स्टॉक पिकअप के लिए तैयार हो।",
    "Product Entry":"उत्पाद प्रविष्टि","Add Product":"उत्पाद जोड़ें","Your Products":"आपके उत्पाद","Harvest Date":"कटाई की तारीख","Farm / Pickup Location":"फार्म / पिकअप स्थान",
    "Monitoring":"निगरानी","Storage Monitoring":"स्टोरेज निगरानी","Temperature":"तापमान","Humidity":"नमी","NDIR CO₂":"NDIR CO₂","Camera feed":"कैमरा फ़ीड","Live":"लाइव",
    "Spoilage Alerts":"खराब होने के अलर्ट","Discounts":"छूट","Payments":"भुगतान","Invoices":"चालान","Notifications":"सूचनाएँ","Marketplace":"मार्केटप्लेस","My Storage":"मेरा भंडारण","My Products":"मेरे उत्पाद","Book Storage":"स्टोरेज बुक करें",
    "Open Monitoring":"निगरानी खोलें","View Live Monitoring":"लाइव निगरानी देखें","Run Prediction":"पूर्वानुमान चलाएँ","Mark Resolved":"समाधान के रूप में चिह्नित करें","Delete":"हटाएँ","Delete all":"सभी हटाएँ",
    "Payment Method":"भुगतान विधि","UPI":"UPI","Card":"कार्ड","Net Banking":"नेट बैंकिंग","Login":"लॉग इन","Log in":"लॉग इन करें","Login as":"इस रूप में लॉग इन करें",
    "Farmer":"किसान","ColdChain Network":"कोल्डचेन नेटवर्क","Farmer Portal":"किसान पोर्टल","Roles":"भूमिकाएँ","Buyer":"खरीदार","Porter":"पोर्टर","Cold Storage":"कोल्ड स्टोरेज",
    "Notifications":"सूचनाएँ","View all":"सभी देखें","Updates stay here even after the popup disappears.":"पॉपअप गायब होने के बाद भी अपडेट यहाँ सुरक्षित रहते हैं।"
  },
  Marathi:{
    "Details":"तपशील","Storage":"साठवण","Travel":"प्रवास","Product + OTP":"उत्पादन + OTP","Payment":"पेमेंट",
    "Select Travel Partner":"प्रवास भागीदार निवडा","Back":"मागे","Continue":"पुढे जा","Generate OTP":"OTP तयार करा","Proceed to Payment":"पेमेंटसाठी पुढे जा",
    "Book Cold Storage Slot":"कोल्ड स्टोरेज स्लॉट बुक करा","Book storage, assign travel, generate pickup OTP and pay.":"स्टोरेज बुक करा, प्रवास भागीदार निवडा, पिकअप OTP तयार करा आणि पेमेंट करा.",
    "Booking Details":"बुकिंग तपशील","Product":"उत्पादन","Quantity (kg)":"प्रमाण (किग्रॅ)","Storage Duration (months)":"साठवण कालावधी (महिने)","Preferred Date":"पसंतीची तारीख","Pickup Location":"पिकअप ठिकाण",
    "Select Cold Storage":"कोल्ड स्टोरेज निवडा","Sort: Distance":"क्रम: अंतर","Sort: Price":"क्रम: किंमत","Available":"उपलब्ध","Price":"किंमत","Est. cost":"अंदाजे खर्च",
    "Payment Method":"पेमेंट पद्धत","Storage Charges":"साठवण शुल्क","Transportation Charges":"वाहतूक शुल्क","Total Amount":"एकूण रक्कम","Payment Successful":"पेमेंट यशस्वी","Your payment has been processed.":"तुमचे पेमेंट यशस्वीपणे प्रक्रिया झाले आहे.","Done":"पूर्ण",
    "Pickup OTP":"पिकअप OTP","Share this OTP with the assigned Porter only when your stock is ready for pickup.":"तुमचा स्टॉक पिकअपसाठी तयार झाल्यावरच हा OTP नियुक्त पोर्टरसह शेअर करा.",
    "Product Entry":"उत्पादन नोंद","Add Product":"उत्पादन जोडा","Your Products":"तुमची उत्पादने","Harvest Date":"कापणीची तारीख","Farm / Pickup Location":"शेत / पिकअप ठिकाण",
    "Monitoring":"निगराणी","Storage Monitoring":"साठवण निगराणी","Temperature":"तापमान","Humidity":"आर्द्रता","Camera feed":"कॅमेरा फीड","Live":"लाइव्ह",
    "Spoilage Alerts":"खराब होण्याचे अलर्ट","Discounts":"सवलत","Payments":"पेमेंट्स","Invoices":"पावत्या","Notifications":"सूचना","Marketplace":"मार्केटप्लेस","My Storage":"माझी साठवण","My Products":"माझी उत्पादने","Book Storage":"स्टोरेज बुक करा",
    "Open Monitoring":"निगराणी उघडा","View Live Monitoring":"लाइव्ह निगराणी पहा","Run Prediction":"अंदाज चालवा","Mark Resolved":"निराकरण म्हणून चिन्हांकित करा","Delete":"हटवा","Delete all":"सर्व हटवा",
    "UPI":"UPI","Card":"कार्ड","Net Banking":"नेट बँकिंग","Login":"लॉग इन","Log in":"लॉग इन करा","Login as":"लॉग इन प्रकार",
    "Farmer":"शेतकरी","ColdChain Network":"कोल्डचेन नेटवर्क","Farmer Portal":"शेतकरी पोर्टल","Roles":"भूमिका","Buyer":"खरेदीदार","Porter":"पोर्टर","Cold Storage":"कोल्ड स्टोरेज",
    "View all":"सर्व पहा","Updates stay here even after the popup disappears.":"पॉपअप गायब झाल्यानंतरही अपडेट्स येथे सुरक्षित राहतात."
  },
  Telugu:{
    "Details":"వివరాలు","Storage":"నిల్వ","Travel":"ప్రయాణం","Product + OTP":"ఉత్పత్తి + OTP","Payment":"చెల్లింపు",
    "Select Travel Partner":"ప్రయాణ భాగస్వామిని ఎంచుకోండి","Back":"వెనుకకు","Continue":"కొనసాగించండి","Generate OTP":"OTP రూపొందించండి","Proceed to Payment":"చెల్లింపుకు కొనసాగండి",
    "Book Cold Storage Slot":"కోల్డ్ స్టోరేజ్ స్లాట్ బుక్ చేయండి","Book storage, assign travel, generate pickup OTP and pay.":"స్టోరేజ్ బుక్ చేసి, ప్రయాణ భాగస్వామిని ఎంచుకుని, పికప్ OTP రూపొందించి చెల్లించండి.",
    "Booking Details":"బుకింగ్ వివరాలు","Product":"ఉత్పత్తి","Quantity (kg)":"పరిమాణం (కిలోలు)","Storage Duration (months)":"నిల్వ వ్యవధి (నెలలు)","Preferred Date":"ఇష్టమైన తేదీ","Pickup Location":"పికప్ ప్రదేశం",
    "Select Cold Storage":"కోల్డ్ స్టోరేజ్ ఎంచుకోండి","Sort: Distance":"క్రమం: దూరం","Sort: Price":"క్రమం: ధర","Available":"అందుబాటులో ఉంది","Price":"ధర","Est. cost":"అంచనా ఖర్చు",
    "Payment Method":"చెల్లింపు విధానం","Storage Charges":"నిల్వ ఛార్జీలు","Transportation Charges":"రవాణా ఛార్జీలు","Total Amount":"మొత్తం మొత్తం","Payment Successful":"చెల్లింపు విజయవంతం","Your payment has been processed.":"మీ చెల్లింపు విజయవంతంగా ప్రాసెస్ చేయబడింది.","Done":"పూర్తయింది",
    "Pickup OTP":"పికప్ OTP","Share this OTP with the assigned Porter only when your stock is ready for pickup.":"మీ స్టాక్ పికప్‌కు సిద్ధమైనప్పుడు మాత్రమే ఈ OTPని కేటాయించిన పోర్టర్‌తో పంచుకోండి.",
    "Product Entry":"ఉత్పత్తి నమోదు","Add Product":"ఉత్పత్తిని జోడించండి","Your Products":"మీ ఉత్పత్తులు","Harvest Date":"పంట తేదీ","Farm / Pickup Location":"ఫార్మ్ / పికప్ ప్రదేశం",
    "Monitoring":"పర్యవేక్షణ","Storage Monitoring":"స్టోరేజ్ పర్యవేక్షణ","Temperature":"ఉష్ణోగ్రత","Humidity":"తేమ","Camera feed":"కెమెరా ఫీడ్","Live":"లైవ్",
    "Spoilage Alerts":"పాడైపోయే హెచ్చరికలు","Discounts":"డిస్కౌంట్లు","Payments":"చెల్లింపులు","Invoices":"ఇన్వాయిసులు","Notifications":"నోటిఫికేషన్లు","Marketplace":"మార్కెట్‌ప్లేస్","My Storage":"నా నిల్వ","My Products":"నా ఉత్పత్తులు","Book Storage":"స్టోరేజ్ బుక్ చేయండి",
    "Open Monitoring":"పర్యవేక్షణ తెరవండి","View Live Monitoring":"లైవ్ పర్యవేక్షణ చూడండి","Run Prediction":"అంచనా నడపండి","Mark Resolved":"పరిష్కరించినట్లు గుర్తించండి","Delete":"తొలగించండి","Delete all":"అన్నీ తొలగించండి",
    "UPI":"UPI","Card":"కార్డ్","Net Banking":"నెట్ బ్యాంకింగ్","Login":"లాగిన్","Log in":"లాగిన్ చేయండి","Login as":"ఇలా లాగిన్ అవ్వండి",
    "Farmer":"రైతు","ColdChain Network":"కోల్డ్‌చైన్ నెట్‌వర్క్","Farmer Portal":"రైతు పోర్టల్","Roles":"పాత్రలు","Buyer":"కొనుగోలుదారు","Porter":"పోర్టర్","Cold Storage":"కోల్డ్ స్టోరేజ్",
    "View all":"అన్నీ చూడండి","Updates stay here even after the popup disappears.":"పాప్‌అప్ కనిపించకుండా పోయిన తర్వాత కూడా అప్‌డేట్‌లు ఇక్కడ భద్రంగా ఉంటాయి."
  },
  Punjabi:{
    "Details":"ਵੇਰਵੇ","Storage":"ਸਟੋਰੇਜ","Travel":"ਯਾਤਰਾ","Product + OTP":"ਉਤਪਾਦ + OTP","Payment":"ਭੁਗਤਾਨ",
    "Select Travel Partner":"ਯਾਤਰਾ ਸਾਥੀ ਚੁਣੋ","Back":"ਵਾਪਸ","Continue":"ਜਾਰੀ ਰੱਖੋ","Generate OTP":"OTP ਬਣਾਓ","Proceed to Payment":"ਭੁਗਤਾਨ ਲਈ ਅੱਗੇ ਵਧੋ",
    "Book Cold Storage Slot":"ਕੋਲਡ ਸਟੋਰੇਜ ਸਲਾਟ ਬੁੱਕ ਕਰੋ","Book storage, assign travel, generate pickup OTP and pay.":"ਸਟੋਰੇਜ ਬੁੱਕ ਕਰੋ, ਯਾਤਰਾ ਸਾਥੀ ਚੁਣੋ, ਪਿਕਅੱਪ OTP ਬਣਾਓ ਅਤੇ ਭੁਗਤਾਨ ਕਰੋ।",
    "Booking Details":"ਬੁਕਿੰਗ ਵੇਰਵੇ","Product":"ਉਤਪਾਦ","Quantity (kg)":"ਮਾਤਰਾ (ਕਿਲੋ)","Storage Duration (months)":"ਸਟੋਰੇਜ ਮਿਆਦ (ਮਹੀਨੇ)","Preferred Date":"ਪਸੰਦੀਦਾ ਮਿਤੀ","Pickup Location":"ਪਿਕਅੱਪ ਸਥਾਨ",
    "Select Cold Storage":"ਕੋਲਡ ਸਟੋਰੇਜ ਚੁਣੋ","Sort: Distance":"ਕ੍ਰਮ: ਦੂਰੀ","Sort: Price":"ਕ੍ਰਮ: ਕੀਮਤ","Available":"ਉਪਲਬਧ","Price":"ਕੀਮਤ","Est. cost":"ਅੰਦਾਜ਼ਨ ਲਾਗਤ",
    "Payment Method":"ਭੁਗਤਾਨ ਵਿਧੀ","Storage Charges":"ਸਟੋਰੇਜ ਚਾਰਜ","Transportation Charges":"ਆਵਾਜਾਈ ਚਾਰਜ","Total Amount":"ਕੁੱਲ ਰਕਮ","Payment Successful":"ਭੁਗਤਾਨ ਸਫਲ","Your payment has been processed.":"ਤੁਹਾਡਾ ਭੁਗਤਾਨ ਸਫਲਤਾਪੂਰਵਕ ਪ੍ਰਕਿਰਿਆ ਕੀਤਾ ਗਿਆ ਹੈ।","Done":"ਹੋ ਗਿਆ",
    "Pickup OTP":"ਪਿਕਅੱਪ OTP","Share this OTP with the assigned Porter only when your stock is ready for pickup.":"ਇਹ OTP ਸਿਰਫ਼ ਉਸ ਵੇਲੇ ਨਿਰਧਾਰਤ ਪੋਰਟਰ ਨਾਲ ਸਾਂਝਾ ਕਰੋ ਜਦੋਂ ਤੁਹਾਡਾ ਸਟਾਕ ਪਿਕਅੱਪ ਲਈ ਤਿਆਰ ਹੋਵੇ।",
    "Product Entry":"ਉਤਪਾਦ ਐਂਟਰੀ","Add Product":"ਉਤਪਾਦ ਸ਼ਾਮਲ ਕਰੋ","Your Products":"ਤੁਹਾਡੇ ਉਤਪਾਦ","Harvest Date":"ਕਟਾਈ ਦੀ ਮਿਤੀ","Farm / Pickup Location":"ਖੇਤ / ਪਿਕਅੱਪ ਸਥਾਨ",
    "Monitoring":"ਨਿਗਰਾਨੀ","Storage Monitoring":"ਸਟੋਰੇਜ ਨਿਗਰਾਨੀ","Temperature":"ਤਾਪਮਾਨ","Humidity":"ਨਮੀ","Camera feed":"ਕੈਮਰਾ ਫੀਡ","Live":"ਲਾਈਵ",
    "Spoilage Alerts":"ਖਰਾਬੀ ਦੇ ਅਲਰਟ","Discounts":"ਛੂਟ","Payments":"ਭੁਗਤਾਨ","Invoices":"ਇਨਵੌਇਸ","Notifications":"ਸੂਚਨਾਵਾਂ","Marketplace":"ਮਾਰਕੀਟਪਲੇਸ","My Storage":"ਮੇਰੀ ਸਟੋਰੇਜ","My Products":"ਮੇਰੇ ਉਤਪਾਦ","Book Storage":"ਸਟੋਰੇਜ ਬੁੱਕ ਕਰੋ",
    "Open Monitoring":"ਨਿਗਰਾਨੀ ਖੋਲ੍ਹੋ","View Live Monitoring":"ਲਾਈਵ ਨਿਗਰਾਨੀ ਵੇਖੋ","Run Prediction":"ਪੂਰਵਾਨੁਮਾਨ ਚਲਾਓ","Mark Resolved":"ਹੱਲ ਵਜੋਂ ਨਿਸ਼ਾਨ ਲਗਾਓ","Delete":"ਮਿਟਾਓ","Delete all":"ਸਭ ਮਿਟਾਓ",
    "UPI":"UPI","Card":"ਕਾਰਡ","Net Banking":"ਨੈੱਟ ਬੈਂਕਿੰਗ","Login":"ਲੌਗ ਇਨ","Log in":"ਲੌਗ ਇਨ ਕਰੋ","Login as":"ਇਸ ਵਜੋਂ ਲੌਗ ਇਨ ਕਰੋ",
    "Farmer":"ਕਿਸਾਨ","ColdChain Network":"ਕੋਲਡਚੇਨ ਨੈੱਟਵਰਕ","Farmer Portal":"ਕਿਸਾਨ ਪੋਰਟਲ","Roles":"ਭੂਮਿਕਾਵਾਂ","Buyer":"ਖਰੀਦਦਾਰ","Porter":"ਪੋਰਟਰ","Cold Storage":"ਕੋਲਡ ਸਟੋਰੇਜ",
    "View all":"ਸਭ ਵੇਖੋ","Updates stay here even after the popup disappears.":"ਪੌਪਅੱਪ ਗਾਇਬ ਹੋਣ ਤੋਂ ਬਾਅਦ ਵੀ ਅਪਡੇਟ ਇੱਥੇ ਸੁਰੱਖਿਅਤ ਰਹਿੰਦੇ ਹਨ।"
  }
};
Object.keys(uiTranslations).forEach(lang=>Object.assign(translations[lang],uiTranslations[lang]));
Object.assign(translations.Hindi,{"Booking Requests":"बुकिंग अनुरोध","Incoming Stock":"आने वाला स्टॉक","Stored Stock":"संग्रहीत स्टॉक","Price Listing":"मूल्य सूची","Profile":"प्रोफ़ाइल","Storage Name":"स्टोरेज का नाम","Full Name":"पूरा नाम","Phone Number":"फ़ोन नंबर","Save Changes":"परिवर्तन सहेजें","Accept Booking":"बुकिंग स्वीकार करें","Reject Booking":"बुकिंग अस्वीकार करें","Accepted":"स्वीकृत","Pending":"लंबित","No pending requests":"कोई लंबित अनुरोध नहीं","No incoming stock":"कोई आने वाला स्टॉक नहीं","No stored stock":"कोई संग्रहीत स्टॉक नहीं"});
Object.assign(translations.Marathi,{"Booking Requests":"बुकिंग विनंत्या","Incoming Stock":"येणारा साठा","Stored Stock":"साठवलेला साठा","Price Listing":"किंमत सूची","Profile":"प्रोफाइल","Storage Name":"स्टोरेजचे नाव","Full Name":"पूर्ण नाव","Phone Number":"फोन नंबर","Save Changes":"बदल जतन करा","Accept Booking":"बुकिंग स्वीकारा","Reject Booking":"बुकिंग नाकारा","Accepted":"स्वीकृत","Pending":"प्रलंबित","No pending requests":"कोणत्याही प्रलंबित विनंत्या नाहीत","No incoming stock":"येणारा साठा नाही","No stored stock":"साठवलेला साठा नाही"});
Object.assign(translations.Telugu,{"Booking Requests":"బుకింగ్ అభ్యర్థనలు","Incoming Stock":"వచ్చే స్టాక్","Stored Stock":"నిల్వ చేసిన స్టాక్","Price Listing":"ధర జాబితా","Profile":"ప్రొఫైల్","Storage Name":"స్టోరేజ్ పేరు","Full Name":"పూర్తి పేరు","Phone Number":"ఫోన్ నంబర్","Save Changes":"మార్పులను సేవ్ చేయండి","Accept Booking":"బుకింగ్‌ను ఆమోదించండి","Reject Booking":"బుకింగ్‌ను తిరస్కరించండి","Accepted":"ఆమోదించబడింది","Pending":"పెండింగ్","No pending requests":"పెండింగ్ అభ్యర్థనలు లేవు","No incoming stock":"వచ్చే స్టాక్ లేదు","No stored stock":"నిల్వ చేసిన స్టాక్ లేదు"});
Object.assign(translations.Punjabi,{"Booking Requests":"ਬੁਕਿੰਗ ਬੇਨਤੀਆਂ","Incoming Stock":"ਆਉਣ ਵਾਲਾ ਸਟਾਕ","Stored Stock":"ਸਟੋਰ ਕੀਤਾ ਸਟਾਕ","Price Listing":"ਕੀਮਤ ਸੂਚੀ","Profile":"ਪ੍ਰੋਫਾਈਲ","Storage Name":"ਸਟੋਰੇਜ ਦਾ ਨਾਮ","Full Name":"ਪੂਰਾ ਨਾਮ","Phone Number":"ਫ਼ੋਨ ਨੰਬਰ","Save Changes":"ਬਦਲਾਅ ਸੁਰੱਖਿਅਤ ਕਰੋ","Accept Booking":"ਬੁਕਿੰਗ ਮਨਜ਼ੂਰ ਕਰੋ","Reject Booking":"ਬੁਕਿੰਗ ਰੱਦ ਕਰੋ","Accepted":"ਮਨਜ਼ੂਰ","Pending":"ਬਕਾਇਆ","No pending requests":"ਕੋਈ ਬਕਾਇਆ ਬੇਨਤੀਆਂ ਨਹੀਂ","No incoming stock":"ਕੋਈ ਆਉਣ ਵਾਲਾ ਸਟਾਕ ਨਹੀਂ","No stored stock":"ਕੋਈ ਸਟੋਰ ਕੀਤਾ ਸਟਾਕ ਨਹੀਂ"});
Object.assign(translations.English,{
  "Booking Requests":"Booking Requests","Incoming Stock":"Incoming Stock","Stored Stock":"Stored Stock","Price Listing":"Price Listing","Profile":"Profile","Cold Storage":"Cold Storage","Storage Name":"Storage Name","Full Name":"Full Name","Phone Number":"Phone Number","Email":"Email","Save Changes":"Save Changes","No pending requests":"No pending requests","No incoming stock":"No incoming stock","No stored stock":"No stored stock","No booking requests match this cold storage name.":"No booking requests match this cold storage name.","Accept Booking":"Accept Booking","Reject Booking":"Reject Booking","Accepted":"Accepted","Pending":"Pending","Farmer":"Farmer","Quantity":"Quantity","Batch":"Batch","Save":"Save","Your profile":"Your profile","Update your account details":"Update your account details",
  "Live trends become available after a cold-storage booking is accepted.":"Live trends become available after a cold-storage booking is accepted.",
  "Live temperature, humidity and NDIR CO₂ trends for accepted stored produce.":"Live temperature, humidity and NDIR CO₂ trends for accepted stored produce.",
  "No accepted stored produce to monitor yet.":"No accepted stored produce to monitor yet.",
  "You have not stored any produce in this cold storage yet.":"You have not stored any produce in this cold storage yet.",
  "Select another cold storage to view its accepted stored produce and live conditions.":"Select another cold storage to view its accepted stored produce and live conditions.",
  "Live temperature, humidity and NDIR CO₂ monitoring for your stored produce.":"Live temperature, humidity and NDIR CO₂ monitoring for your stored produce.",
  "Live sensors, camera feed and AI spoilage prediction.":"Live sensors, camera feed and AI spoilage prediction.",
  "Choose the cold storage where you want to see live conditions.":"Choose the cold storage where you want to see live conditions.",
  "Nothing to monitor":"Nothing to monitor",
  "Live monitoring starts only after a cold-storage booking is accepted and the produce is stored.":"Live monitoring starts only after a cold-storage booking is accepted and the produce is stored.",
  "Visual spoilage observation associated with batch":"Visual spoilage observation associated with batch",
  "Sensor and camera data are associated with batch":"Sensor and camera data are associated with batch",
  "and are used by the spoilage-risk prediction.":"and are used by the spoilage-risk prediction.",
  "Checking…":"Checking…",
  "Open Monitoring":"Open Monitoring"
});
Object.assign(translations.Hindi,{
  "Live trends become available after a cold-storage booking is accepted.":"कोल्ड स्टोरेज द्वारा बुकिंग स्वीकार किए जाने के बाद लाइव ट्रेंड उपलब्ध होंगे।",
  "Live temperature, humidity and NDIR CO₂ trends for accepted stored produce.":"स्वीकृत संग्रहीत उपज के तापमान, नमी और NDIR CO₂ के लाइव ट्रेंड।",
  "No accepted stored produce to monitor yet.":"अभी निगरानी के लिए कोई स्वीकृत संग्रहीत उपज नहीं है।",
  "You have not stored any produce in this cold storage yet.":"आपने अभी तक इस कोल्ड स्टोरेज में कोई उपज संग्रहीत नहीं की है।",
  "Select another cold storage to view its accepted stored produce and live conditions.":"इसकी स्वीकृत संग्रहीत उपज और लाइव स्थितियाँ देखने के लिए कोई दूसरा कोल्ड स्टोरेज चुनें।",
  "Live temperature, humidity and NDIR CO₂ monitoring for your stored produce.":"आपकी संग्रहीत उपज के तापमान, नमी और NDIR CO₂ की लाइव निगरानी।",
  "Live sensors, camera feed and AI spoilage prediction.":"लाइव सेंसर, कैमरा फ़ीड और AI खराबी पूर्वानुमान।",
  "Choose the cold storage where you want to see live conditions.":"वह कोल्ड स्टोरेज चुनें जहाँ आप लाइव स्थितियाँ देखना चाहते हैं।",
  "Nothing to monitor":"निगरानी के लिए कुछ नहीं",
  "Live monitoring starts only after a cold-storage booking is accepted and the produce is stored.":"लाइव निगरानी तभी शुरू होती है जब कोल्ड स्टोरेज बुकिंग स्वीकार हो जाए और उपज संग्रहीत हो जाए।",
  "Visual spoilage observation associated with batch":"बैच से जुड़ा दृश्य खराबी निरीक्षण",
  "Sensor and camera data are associated with batch":"सेंसर और कैमरा डेटा इस बैच से जुड़े हैं",
  "and are used by the spoilage-risk prediction.":"और खराबी-जोखिम पूर्वानुमान में उपयोग किए जाते हैं।",
  "Checking…":"जाँच हो रही है…",
  "Open Monitoring":"निगरानी खोलें"
});
Object.assign(translations.Marathi,{
  "Live trends become available after a cold-storage booking is accepted.":"कोल्ड स्टोरेजने बुकिंग स्वीकार केल्यानंतर लाइव्ह ट्रेंड उपलब्ध होतील.",
  "Live temperature, humidity and NDIR CO₂ trends for accepted stored produce.":"स्वीकृत साठवलेल्या उत्पादनाचे तापमान, आर्द्रता आणि NDIR CO₂ चे लाइव्ह ट्रेंड.",
  "No accepted stored produce to monitor yet.":"अद्याप निगराणीसाठी कोणतेही स्वीकृत साठवलेले उत्पादन नाही.",
  "You have not stored any produce in this cold storage yet.":"तुम्ही अद्याप या कोल्ड स्टोरेजमध्ये कोणतेही उत्पादन साठवलेले नाही.",
  "Select another cold storage to view its accepted stored produce and live conditions.":"त्यातील स्वीकृत साठवलेले उत्पादन आणि लाइव्ह स्थिती पाहण्यासाठी दुसरे कोल्ड स्टोरेज निवडा.",
  "Live temperature, humidity and NDIR CO₂ monitoring for your stored produce.":"तुमच्या साठवलेल्या उत्पादनाचे तापमान, आर्द्रता आणि NDIR CO₂ ची लाइव्ह निगराणी.",
  "Live sensors, camera feed and AI spoilage prediction.":"लाइव्ह सेन्सर, कॅमेरा फीड आणि AI खराबी अंदाज.",
  "Choose the cold storage where you want to see live conditions.":"जिथे तुम्हाला लाइव्ह स्थिती पाहायची आहे ते कोल्ड स्टोरेज निवडा.",
  "Nothing to monitor":"निगराणीसाठी काहीही नाही",
  "Live monitoring starts only after a cold-storage booking is accepted and the produce is stored.":"कोल्ड स्टोरेज बुकिंग स्वीकारल्यानंतर आणि उत्पादन साठवल्यानंतरच लाइव्ह निगराणी सुरू होते.",
  "Visual spoilage observation associated with batch":"बॅचशी संबंधित दृश्य खराबी निरीक्षण",
  "Sensor and camera data are associated with batch":"सेन्सर आणि कॅमेरा डेटा या बॅचशी संबंधित आहेत",
  "and are used by the spoilage-risk prediction.":"आणि खराबी-जोखीम अंदाजासाठी वापरले जातात.",
  "Checking…":"तपासणी सुरू आहे…",
  "Open Monitoring":"निगराणी उघडा"
});
Object.assign(translations.Telugu,{
  "Live trends become available after a cold-storage booking is accepted.":"కోల్డ్ స్టోరేజ్ బుకింగ్ ఆమోదించబడిన తర్వాత లైవ్ ట్రెండ్‌లు అందుబాటులో ఉంటాయి.",
  "Live temperature, humidity and NDIR CO₂ trends for accepted stored produce.":"ఆమోదించబడిన నిల్వ ఉత్పత్తికి ఉష్ణోగ్రత, తేమ మరియు NDIR CO₂ లైవ్ ట్రెండ్‌లు.",
  "No accepted stored produce to monitor yet.":"ఇప్పటివరకు పర్యవేక్షించడానికి ఆమోదించబడిన నిల్వ ఉత్పత్తి లేదు.",
  "You have not stored any produce in this cold storage yet.":"మీరు ఇంకా ఈ కోల్డ్ స్టోరేజ్‌లో ఏ ఉత్పత్తినీ నిల్వ చేయలేదు.",
  "Select another cold storage to view its accepted stored produce and live conditions.":"ఆమోదించబడిన నిల్వ ఉత్పత్తి మరియు లైవ్ పరిస్థితులను చూడటానికి మరొక కోల్డ్ స్టోరేజ్‌ను ఎంచుకోండి.",
  "Live temperature, humidity and NDIR CO₂ monitoring for your stored produce.":"మీ నిల్వ ఉత్పత్తికి ఉష్ణోగ్రత, తేమ మరియు NDIR CO₂ లైవ్ పర్యవేక్షణ.",
  "Live sensors, camera feed and AI spoilage prediction.":"లైవ్ సెన్సర్లు, కెమెరా ఫీడ్ మరియు AI చెడిపోవు అంచనా.",
  "Choose the cold storage where you want to see live conditions.":"లైవ్ పరిస్థితులను చూడాలనుకునే కోల్డ్ స్టోరేజ్‌ను ఎంచుకోండి.",
  "Nothing to monitor":"పర్యవేక్షించడానికి ఏమీ లేదు",
  "Live monitoring starts only after a cold-storage booking is accepted and the produce is stored.":"కోల్డ్ స్టోరేజ్ బుకింగ్ ఆమోదించబడి ఉత్పత్తి నిల్వ చేసిన తర్వాతే లైవ్ పర్యవేక్షణ ప్రారంభమవుతుంది.",
  "Visual spoilage observation associated with batch":"బ్యాచ్‌కు సంబంధించిన దృశ్య చెడిపోవు పరిశీలన",
  "Sensor and camera data are associated with batch":"సెన్సర్ మరియు కెమెరా డేటా ఈ బ్యాచ్‌కు అనుసంధానించబడ్డాయి",
  "and are used by the spoilage-risk prediction.":"మరియు చెడిపోవు ప్రమాద అంచనాలో ఉపయోగించబడతాయి.",
  "Checking…":"తనిఖీ చేస్తోంది…",
  "Open Monitoring":"పర్యవేక్షణ తెరవండి"
});
Object.assign(translations.Punjabi,{
  "Live trends become available after a cold-storage booking is accepted.":"ਕੋਲਡ ਸਟੋਰੇਜ ਵੱਲੋਂ ਬੁਕਿੰਗ ਮਨਜ਼ੂਰ ਹੋਣ ਤੋਂ ਬਾਅਦ ਲਾਈਵ ਰੁਝਾਨ ਉਪਲਬਧ ਹੋਣਗੇ।",
  "Live temperature, humidity and NDIR CO₂ trends for accepted stored produce.":"ਮਨਜ਼ੂਰ ਕੀਤੀ ਸਟੋਰ ਕੀਤੀ ਉਪਜ ਲਈ ਤਾਪਮਾਨ, ਨਮੀ ਅਤੇ NDIR CO₂ ਦੇ ਲਾਈਵ ਰੁਝਾਨ।",
  "No accepted stored produce to monitor yet.":"ਅਜੇ ਨਿਗਰਾਨੀ ਲਈ ਕੋਈ ਮਨਜ਼ੂਰ ਕੀਤੀ ਸਟੋਰ ਕੀਤੀ ਉਪਜ ਨਹੀਂ ਹੈ।",
  "You have not stored any produce in this cold storage yet.":"ਤੁਸੀਂ ਅਜੇ ਤੱਕ ਇਸ ਕੋਲਡ ਸਟੋਰੇਜ ਵਿੱਚ ਕੋਈ ਉਪਜ ਸਟੋਰ ਨਹੀਂ ਕੀਤੀ।",
  "Select another cold storage to view its accepted stored produce and live conditions.":"ਇਸ ਦੀ ਮਨਜ਼ੂਰ ਕੀਤੀ ਸਟੋਰ ਕੀਤੀ ਉਪਜ ਅਤੇ ਲਾਈਵ ਸਥਿਤੀਆਂ ਵੇਖਣ ਲਈ ਕੋਈ ਹੋਰ ਕੋਲਡ ਸਟੋਰੇਜ ਚੁਣੋ।",
  "Live temperature, humidity and NDIR CO₂ monitoring for your stored produce.":"ਤੁਹਾਡੀ ਸਟੋਰ ਕੀਤੀ ਉਪਜ ਲਈ ਤਾਪਮਾਨ, ਨਮੀ ਅਤੇ NDIR CO₂ ਦੀ ਲਾਈਵ ਨਿਗਰਾਨੀ।",
  "Live sensors, camera feed and AI spoilage prediction.":"ਲਾਈਵ ਸੈਂਸਰ, ਕੈਮਰਾ ਫੀਡ ਅਤੇ AI ਖਰਾਬੀ ਪੂਰਵਾਨੁਮਾਨ।",
  "Choose the cold storage where you want to see live conditions.":"ਉਹ ਕੋਲਡ ਸਟੋਰੇਜ ਚੁਣੋ ਜਿੱਥੇ ਤੁਸੀਂ ਲਾਈਵ ਸਥਿਤੀਆਂ ਵੇਖਣਾ ਚਾਹੁੰਦੇ ਹੋ।",
  "Nothing to monitor":"ਨਿਗਰਾਨੀ ਲਈ ਕੁਝ ਨਹੀਂ",
  "Live monitoring starts only after a cold-storage booking is accepted and the produce is stored.":"ਲਾਈਵ ਨਿਗਰਾਨੀ ਕੋਲਡ ਸਟੋਰੇਜ ਬੁਕਿੰਗ ਮਨਜ਼ੂਰ ਹੋਣ ਅਤੇ ਉਪਜ ਸਟੋਰ ਹੋਣ ਤੋਂ ਬਾਅਦ ਹੀ ਸ਼ੁਰੂ ਹੁੰਦੀ ਹੈ।",
  "Visual spoilage observation associated with batch":"ਬੈਚ ਨਾਲ ਜੁੜਿਆ ਦ੍ਰਿਸ਼ਟੀਗਤ ਖਰਾਬੀ ਨਿਰੀਖਣ",
  "Sensor and camera data are associated with batch":"ਸੈਂਸਰ ਅਤੇ ਕੈਮਰਾ ਡਾਟਾ ਇਸ ਬੈਚ ਨਾਲ ਜੁੜੇ ਹਨ",
  "and are used by the spoilage-risk prediction.":"ਅਤੇ ਖਰਾਬੀ-ਜੋਖਮ ਪੂਰਵਾਨੁਮਾਨ ਵਿੱਚ ਵਰਤੇ ਜਾਂਦੇ ਹਨ।",
  "Checking…":"ਜਾਂਚ ਹੋ ਰਹੀ ਹੈ…",
  "Open Monitoring":"ਨਿਗਰਾਨੀ ਖੋਲ੍ਹੋ"
});


function getLanguageCode(){const v=localStorage.getItem('agrisetuLanguage')||'EN';return ({EN:'English','हिन्दी':'Hindi','मराठी':'Marathi','తెలుగు':'Telugu','ਪੰਜਾਬੀ':'Punjabi'})[v]||'English';}
function getLanguageLabel(){return localStorage.getItem('agrisetuLanguage')||'EN';}
function t(text){return (translations[getLanguageCode()]||{})[text]||text;}
function toggleLanguageMenu(event){if(event)event.stopPropagation();document.getElementById('language-menu')?.classList.toggle('show');}
function selectLanguage(name,label){localStorage.setItem('agrisetuLanguage',label);document.documentElement.lang=({EN:'en','हिन्दी':'hi','मराठी':'mr','తెలుగు':'te','ਪੰਜਾਬੀ':'pa'})[label]||'en';document.getElementById('language-menu')?.classList.remove('show');render();}
function applyLanguage(){
  const map=translations[getLanguageCode()]||{};
  if(!Object.keys(map).length)return;
  const walker=document.createTreeWalker(document.getElementById('app')||document.body,NodeFilter.SHOW_TEXT);
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(node=>{const raw=node.nodeValue,trim=raw.trim();if(map[trim])node.nodeValue=raw.replace(trim,map[trim]);});
}
document.addEventListener('click',e=>{const wrap=document.querySelector('.language-wrap');const menu=document.getElementById('language-menu');if(menu&&wrap&&!wrap.contains(e.target))menu.classList.remove('show');});
function pageTitle(){return ({dashboard:"Dashboard",book:"Book Storage",storage:"My Storage",products:"My Products",market:"Marketplace",monitor:"Monitoring",alerts:"Spoilage Alerts",discounts:"Discounts",payments:"Payments",invoices:"Invoices",notifications:"Notifications",requests:"Booking Requests",incoming:"Incoming Stock",stored:"Stored Stock",price:"Price Listing",profile:"Profile"})[state.page]||"Dashboard";}

function dashboard(){
  const products=acceptedProducts(), bookings=readStore("bookings",[]), alerts=readStore("alerts",[]), listings=globalMarketplace().filter(l=>l.status==="Active");
  const storedKg=products.reduce((a,p)=>a+Number(p.quantity||0),0);
  const activeAlerts=alerts.filter(a=>a.status!=="RESOLVED" && products.some(p=>p.batchId===a.batch)).length;
  const latestAlert=alerts.find(a=>a.status!=="RESOLVED" && products.some(p=>p.batchId===a.batch));
  return `<div class="page-head"><div class="page-icon">▤</div><div><h1>Welcome back, ${escapeHtml(state.user||"Farmer")}</h1><p>Your farm-to-market supply chain at a glance</p></div><div class="head-actions"><button class="btn btn-primary" onclick="navigate('book')">＋ &nbsp; Book Storage</button></div></div>
  ${latestAlert?`<div class="alert"><div class="round">⚠</div><div><h3>⚠ Spoilage Risk Detected</h3><p>Batch: <b>${escapeHtml(latestAlert.batch)}</b> · Risk: <b>${escapeHtml(latestAlert.status)}</b> · Probability: ${latestAlert.risk}%</p><p>Sell the batch quickly through the marketplace at a discounted price.</p><button class="btn" onclick="navigate('alerts')">View alerts　→</button></div></div>`:""}
  <div class="cards">${metric("♧",`${storedKg.toLocaleString()} kg`,`Total Stored`)}${metric("▤",`${bookings.filter(b=>b.status!=="Completed").length}`,"Active Bookings","blue")}${metric("▣",`${listings.length}`,"Marketplace Listings","purple")}${metric("⚠",`${activeAlerts}`,"Active Alerts","red")}</div>
  <div class="card section-card"><div class="section-header"><h2>Current Stored Products</h2><button class="link-btn" onclick="navigate('storage')">View all</button></div>${products.length?products.slice(0,4).map(p=>`<div class="product-row"><div class="product-icon">◇</div><div class="product-info"><b>${escapeHtml(p.product)} · ${escapeHtml(p.batchId)}</b><span>${Number(p.quantity).toLocaleString()} kg · ${escapeHtml(p.storage)}</span></div><span class="pill green">Accepted & Stored</span></div>`).join(""):emptyState("No accepted storage yet","Products appear here after the selected cold storage accepts the booking.","storage","View My Storage")}</div>
  <div class="card section-card"><div class="section-header"><h2>Storage Bookings</h2><button class="link-btn" onclick="navigate('storage')">View all</button></div>${bookings.length?bookings.slice(0,4).map(bookingTimeline).join(""):emptyState("No bookings yet","Book a cold-storage slot for a product from My Products.","book","Book Storage")}</div>
  ${dashboardMonitoringSection(products)}
  ${recentActivity()}
  `;
}
function metric(ic,n,l,c=""){return `<div class="card metric ${c}"><div class="metric-icon">${ic}</div><b>${n}</b><span>${l}</span></div>`;}
function timeline(){return `<div class="timeline">${["Booked","Assigned","Picked","Transit","Stored"].map((n,i)=>`${i?'<div class="connector done"></div>':''}<div class="step ${i<2?'done':''} ${i===1?'current':''}"><div class="circle">${i===0?'✓':i+1}</div><label>${n}</label></div>`).join("")}</div>`;}
function bookingTimeline(b){const current=Math.min(Number(b.step||1),5);return `<div class="booking-mini"><div><b>${escapeHtml(b.product)}</b><span>${escapeHtml(b.storage)} · ${Number(b.quantity).toLocaleString()} kg</span></div><span class="pill green">${escapeHtml(b.status||"Booked")}</span></div>${["Booked","Assigned","Picked","Transit","Stored"].map((n,i)=>i===current-1?`<div class="booking-status">● ${n} — ${escapeHtml(b.batchId)}</div>`:"").join("")}`;}
function recentActivity(){const ns=readStore("notifications",[]);return (ns.length?ns.slice(0,4):[{title:"No recent activity",message:"Your new supply-chain updates will appear here."}]).map(n=>`<div class="activity"><span class="dot"></span><div><b>${escapeHtml(n.title)}</b><span>${escapeHtml(n.message)}</span><small style="color:#9aa8a2">${n.createdAt?timeAgo(n.createdAt):"Now"}</small></div></div>`).join("");}
function emptyState(title,text,page,button){return `<div class="empty-state"><h3>${title}</h3><p>${text}</p><button class="btn btn-primary" onclick="navigate('${page}')">${button}</button></div>`;}

function bookStepper(){return `<div class="card"><div class="stepper">${[[1,"Details"],[2,"Storage"],[3,"Travel"],[4,"Product + OTP"],[5,"Payment"]].map(([n,l])=>`<div class="s ${state.bookingStep>=n?'active':''}"><div class="n">${n}</div><span>${l}</span></div>${n<5?'<div class="stepper-line"></div>':''}`).join("")}</div></div>`;}
function book(){return state.bookingStep===1?bookingDetails():state.bookingStep===2?selectStorage():state.bookingStep===3?selectPorter():productOtp();}
function bookingDetails(){
  const products=readStore("products",[]);
  if(!products.length){return `<div class="page-head"><div class="page-icon">▤</div><div><h1>Book Cold Storage Slot</h1><p>Add your product to My Products before booking a storage slot.</p></div></div><div class="card empty-state"><h3>Product entry required</h3><p>Your workflow starts with adding the produce and batch details.</p><button class="btn btn-primary" onclick="navigate('products')">＋ Add Product</button></div>`;}
  return `<div class="page-head"><div class="page-icon">▤</div><div><h1>Book Cold Storage Slot</h1><p>Book storage, assign travel, generate pickup OTP and pay.</p></div></div>${bookStepper()}<div class="card"><h2>Booking Details</h2><div class="form-grid" style="margin-top:30px"><div class="field"><label>Product</label><select id="bookProduct">${products.map(p=>`<option value="${escapeAttr(p.id)}">${escapeHtml(p.product)} · ${escapeHtml(p.batchId)}</option>`).join("")}</select></div><div class="field"><label>Quantity (kg)</label><input id="bookQuantity" type="number" value="${Number(products[0].quantity)}" min="1"></div><div class="field"><label>Storage Duration (months)</label><input id="bookDuration" type="number" value="3" min="1"></div><div class="field"><label>Preferred Date</label><input id="bookDate" type="date"></div><div class="field full"><label>Pickup Location</label><input id="bookLocation" value="${escapeAttr(products[0].location||"Agra")}"></div></div><div class="actions"><button class="btn btn-outline" onclick="navigate('dashboard')">← Back</button><button class="btn btn-primary" onclick="saveBookingDetails()">Continue　→</button></div></div>`;
}
function saveBookingDetails(){const id=document.getElementById("bookProduct")?.value;const p=readStore("products",[]).find(x=>x.id===id);const qty=Number(document.getElementById("bookQuantity")?.value||0);if(!p||qty<=0)return alert("Please select a product and enter a valid quantity.");state.bookingProduct=p.product;state.bookingQuantity=qty;state.batchId=p.batchId;state.bookingProductId=p.id;state.bookingLocation=document.getElementById("bookLocation")?.value||p.location||"Agra";state.bookingDuration=Number(document.getElementById("bookDuration")?.value||3);state.bookingDate=document.getElementById("bookDate")?.value||"TBD";state.bookingStep=2;render();}
function selectStorage(){return `<div class="page-head"><div class="page-icon">❄️</div><div><h1>Select Cold Storage</h1><p>Choose a nearby cold storage for your produce.</p></div></div>${bookStepper()}<div class="card"><div class="section-header"><h2>Select Cold Storage</h2><select style="width:240px;height:54px;border:1px solid var(--border);border-radius:10px;padding:0 16px"><option>Sort: Distance</option><option>Sort: Price</option></select></div><div class="storage-list">${storageOptions.map((s,i)=>`<div class="choice ${state.selectedStorage===i?'selected':''}" onclick="chooseStorage(${i})"><div><div class="name">❄️　${s.name}</div><div class="muted">⌖ ${s.location} · ${s.distance}</div></div><div><div class="stat-label">Available</div><div class="stat-value">${s.available}</div><div class="stat-label" style="margin-top:10px">Price</div><div class="stat-value">₹${s.price}/kg/month</div></div><div class="price">Est. cost<br>₹${s.cost.toLocaleString()}</div></div>`).join("")}</div><div class="actions"><button class="btn btn-outline" onclick="nextBooking(1)">← Back</button><button class="btn btn-primary" ${state.selectedStorage===null?'disabled style="opacity:.5"':''} onclick="nextBooking(3)">Continue　→</button></div></div>`;}
function selectPorter(){return `<div class="page-head"><div class="page-icon">🚚</div><div><h1>Select Travel Partner</h1><p>Choose a porter for pickup.</p></div></div>${bookStepper()}<div class="card"><h2>Select Travel Partner</h2><div class="porter-list" style="margin-top:28px">${porterOptions.map((p,i)=>`<div class="choice ${state.selectedPorter===i?'selected':''}" onclick="choosePorter(${i})" style="grid-template-columns:1fr auto"><div><div class="name">🚚　${p.name}</div><div class="muted">${p.type} · ETA ${p.eta} · ${p.distance}</div></div><div class="price">₹${p.price.toLocaleString()}</div></div>`).join("")}</div><div class="actions"><button class="btn btn-outline" onclick="nextBooking(2)">← Back</button><button class="btn btn-primary" ${state.selectedPorter===null?'disabled style="opacity:.5"':''} onclick="nextBooking(4)">Generate OTP　→</button></div></div>`;}
function productOtp(){const product=state.bookingProduct||"Potato",qty=state.bookingQuantity||1000;return `<div class="page-head"><div class="page-icon">▤</div><div><h1>Product Entry</h1><p>Confirm your batch and pickup details.</p></div></div>${bookStepper()}<div class="card"><div class="form-grid">${info("Farmer Name",state.user)}${info("Product",product)}${info("Quantity",`${Number(qty).toLocaleString()} kg`)}${info("Batch ID",state.batchId||"POT-3191")}${info("Cold Storage",storageOptions[state.selectedStorage??2].name)}${info("Travel Partner",porterOptions[state.selectedPorter??0].name)}${info("Pickup Date",state.bookingDate||"TBD")}${info("Pickup Location",state.bookingLocation||"Agra")}</div><div class="otp-box"><div class="otp-label">Pickup OTP</div><div class="otp">${state.otp||"150240"}</div><p>Share this OTP with the assigned Porter only when your stock is ready for pickup.</p></div><div class="actions"><button class="btn btn-outline" onclick="nextBooking(3)">← Back</button><button class="btn btn-primary" onclick="openPayment()">Proceed to Payment　→</button></div></div>`;}
function info(k,v){return `<div style="background:#f8fbf9;padding:17px;border-radius:10px"><div style="color:var(--muted)">${k}</div><b style="display:block;margin-top:6px">${escapeHtml(v)}</b></div>`;}

function productsPage(){
  const products=readStore("products",[]);
  const productRows=products.map(p=>`<div class="product-row product-management"><div class="product-icon">◇</div><div class="product-info"><b>${escapeHtml(p.product)} · ${escapeHtml(p.batchId)}</b><span>${Number(p.quantity).toLocaleString()} kg · ${escapeHtml(p.location)} · ${p.storage?escapeHtml(p.storage):"Storage not booked"}</span></div><div class="product-actions"><button class="btn btn-outline" onclick="deleteProduct('${p.id}')">Delete</button>${p.storage?'<span class="pill green">Stored</span>':`<button class="btn btn-primary" onclick="startBookingForProduct('${p.id}')">Book Storage</button>`}</div></div>`).join("");
  return `<div class="page-head"><div class="page-icon">◇</div><div><h1>My Products</h1><p>Enter and manage your farm produce before booking storage.</p></div></div><div class="card"><h2>Add Product</h2><div class="form-grid" style="margin-top:25px"><div class="field"><label>Product</label><select id="productName"><option>Potato</option><option>Tomato</option><option>Onion</option><option>Carrot</option><option>Apple</option><option>Cauliflower</option></select></div><div class="field"><label>Quantity (kg)</label><input id="productQty" type="number" min="1" placeholder="e.g. 1000"></div><div class="field"><label>Harvest Date</label><input id="harvestDate" type="date"></div><div class="field"><label>Farm / Pickup Location</label><input id="farmLocation" value="Agra"></div></div><button class="btn btn-primary" style="margin-top:25px" onclick="addProduct()">＋ Add Product</button></div><div class="card section-card"><div class="section-header"><h2>Your Products</h2><span class="muted">${products.length} product(s)</span></div>${products.length?productRows:emptyState("No products yet","Enter your produce here before booking a cold-storage slot.","products","＋ Add Product")}</div>`;
}
function addProduct(){const product=document.getElementById("productName").value,quantity=Number(document.getElementById("productQty").value),location=document.getElementById("farmLocation").value.trim()||"Agra";if(!quantity||quantity<=0)return alert("Please enter a valid quantity.");const products=readStore("products",[]),p={id:uid("PRD"),product,quantity,location,batchId:`${product.slice(0,3).toUpperCase()}-${Math.floor(1000+Math.random()*9000)}`,harvestDate:document.getElementById("harvestDate").value||"",storage:null,createdAt:Date.now()};products.unshift(p);writeStore("products",products);addNotification("Product added",`${product} (${quantity.toLocaleString()} kg) was added to My Products.`);render();}
function deleteProduct(id){writeStore("products",readStore("products",[]).filter(p=>p.id!==id));render();}
function startBookingForProduct(id){const p=readStore("products",[]).find(x=>x.id===id);if(!p)return;state.bookingProduct=p.product;state.bookingQuantity=p.quantity;state.batchId=p.batchId;state.bookingLocation=p.location;state.bookingStep=2;state.page="book";render();}

function marketplacePage(){
  migrateMarketplace();
  const all=globalMarketplace().filter(l=>l.status==="Active");
  const listings=state.role==="Buyer"?all:all.filter(l=>l.seller===state.user);
  const products=acceptedProducts();
  return `<div class="page-head"><div class="page-icon">🛒</div><div><h1>Marketplace</h1><p>${state.role==="Buyer"?"Browse fresh and discounted produce from farmers.":"List your accepted stored produce for buyers and manage active listings."}</p></div></div>
  ${state.role!=="Buyer"?`<div class="card"><h2>Create Marketplace Listing</h2><div class="form-grid" style="margin-top:25px"><div class="field"><label>Product / Batch</label><select id="marketProduct">${products.map(p=>`<option value="${escapeAttr(p.id)}">${escapeHtml(p.product)} · ${escapeHtml(p.batchId)}</option>`).join("")||'<option value="">No accepted stored product</option>'}</select></div><div class="field"><label>Quantity (kg)</label><input id="marketQty" type="number" value="${products[0]?Number(products[0].quantity):0}" min="1"></div><div class="field"><label>Selling Price (₹/kg)</label><input id="marketPrice" type="number" step="0.1" value="25"></div><div class="field"><label>Listing Status</label><select id="marketStatus"><option>Active</option><option>Paused</option></select></div></div><button class="btn btn-primary" style="margin-top:25px" ${products.length?"":"disabled style='opacity:.5'"} onclick="createListing()">＋ List for Sale</button></div>`:""}
  <div class="card section-card"><div class="section-header"><h2>${state.role==="Buyer"?"Available Produce":"My Active Listings"}</h2></div>${listings.length?listings.map(l=>`<div class="product-row"><div class="product-icon">🛒</div><div class="product-info"><b>${escapeHtml(l.product)} · ${escapeHtml(l.batchId)}</b><span>${Number(l.quantity).toLocaleString()} kg · ₹${Number(l.price).toFixed(2)}/kg${l.discountedPrice?` · Discounted from ₹${Number(l.originalPrice).toFixed(2)}/kg`:""}${state.role==="Buyer"&&l.seller?` · Seller: ${escapeHtml(l.seller)}`:""}</span></div>${l.discountedPrice?'<span class="pill green">Discounted</span>':'<span class="pill green">Active</span>'}</div>`).join(""):emptyState(state.role==="Buyer"?"No produce available":"No marketplace listings",state.role==="Buyer"?"Discounted and active farmer listings will appear here.":"Only accepted stored products can be listed.","storage","View My Storage")}</div>`;
}
function createListing(){
  const products=acceptedProducts(),p=products.find(x=>x.id===document.getElementById("marketProduct")?.value);
  if(!p)return alert("Only accepted stored products can be listed.");
  const qty=Number(document.getElementById("marketQty").value),price=Number(document.getElementById("marketPrice").value);
  if(qty<=0||price<=0||qty>Number(p.quantity))return alert("Enter a valid quantity within the stored quantity.");
  migrateMarketplace();
  const listings=globalMarketplace();
  listings.unshift({id:uid("LST"),product:p.product,batchId:p.batchId,quantity:qty,price,status:document.getElementById("marketStatus").value,seller:state.user,sellerRole:"Farmer",createdAt:Date.now()});
  writeGlobalMarketplace(listings);
  addNotification("Marketplace listing created",`${p.product} (${qty.toLocaleString()} kg) is listed at ₹${price}/kg.`);
  render();
}

function alertsPage(){
  const stored=acceptedProducts(), storedBatches=new Set(stored.map(p=>p.batchId));
  const alerts=readStore("alerts",[]).filter(a=>storedBatches.has(a.batch));
  return `<div class="page-head"><div class="page-icon">⚠</div><div><h1>Spoilage Alerts</h1><p>ML-based risk prediction from temperature, humidity, NDIR CO₂ and camera observations.</p></div></div>
  <div class="card sensor-summary"><div><b>Prediction engine</b><span>Raspberry Pi + PT100 RTD + industrial humidity sensor + NDIR CO₂ sensor + camera</span></div><button class="btn btn-outline" onclick="runPrediction()">Run Prediction</button></div>
  ${alerts.length?alerts.map(a=>`<div class="card risk-card ${a.status.toLowerCase()}"><div class="risk-head"><div><h2>${escapeHtml(a.product)} · ${escapeHtml(a.batch)}</h2><span>${escapeHtml(a.camera||"Camera analysis available")}</span></div><div class="risk-score">${a.risk}%<small>risk</small></div></div><div class="risk-meter"><span style="width:${a.risk}%"></span></div><div class="sensor-grid"><div><span>Temperature</span><b>${a.temperature}°C</b></div><div><span>Humidity</span><b>${a.humidity}%</b></div><div><span>NDIR CO₂</span><b>${a.co2||"—"} ppm</b></div><div><span>Status</span><b>${escapeHtml(a.status)}</b></div></div><div class="risk-actions"><button class="btn btn-primary" onclick="navigate('market')">List in Marketplace</button><button class="btn btn-outline" onclick="prepareDiscount('${a.id}')">Create Discount</button><button class="btn btn-outline" onclick="resolveAlert('${a.id}')">Mark Resolved</button></div></div>`).join(""):emptyState("No spoilage alerts","Alerts are generated only for products accepted and stored in Cold Storage.","storage","View My Storage")}`;
}
function runPrediction(){
  const stored=acceptedProducts();
  if(!stored.length)return alert("No accepted/stored product is available for prediction.");
  const p=stored[0],s=sensorSnapshot(p.batchId),camera=Math.random()>.55?"Early spoilage signs detected":"No visible spoilage detected";
  let risk=Math.round(Math.min(99,Math.max(4,(s.temperature-3)*6+(s.humidity-70)*0.9+(s.co2-650)/60+(camera.includes("Early")?20:0))));
  const status=risk>=70?"HIGH":risk>=40?"MEDIUM":"LOW";
  const alerts=readStore("alerts",[]).filter(a=>stored.some(x=>x.batchId===a.batch));
  const existing=alerts.find(a=>a.batch===p.batchId);
  const record={id:existing?.id||uid("ALT"),batch:p.batchId,product:p.product,risk,status,temperature:s.temperature,humidity:s.humidity,co2:s.co2,camera,createdAt:Date.now()};
  const remaining=readStore("alerts",[]).filter(a=>a.batch!==p.batchId);
  remaining.unshift(record);writeStore("alerts",remaining.slice(0,20));
  addNotification("Spoilage prediction updated",`ML prediction reports ${risk}% risk for ${p.product} · ${p.batchId}.`,risk>=70?"danger":"info");
  render();
}
function resolveAlert(id){writeStore("alerts",readStore("alerts",[]).map(a=>a.id===id?{...a,status:"RESOLVED"}:a));addNotification("Spoilage alert resolved","The selected product risk alert was marked resolved.");render();}

function prepareDiscount(id){state.discountAlertId=id;state.page="discounts";render();}

function discountsPage(){
  const discounts=readStore("discounts",[]);
  const stored=acceptedProducts(), batches=new Set(stored.map(p=>p.batchId));
  const alerts=readStore("alerts",[]).filter(a=>batches.has(a.batch));
  return `<div class="page-head"><div class="page-icon">◇</div><div><h1>Discounts</h1><p>Reduce the selling price of stored produce and publish it directly to the buyer marketplace.</p></div></div>
  <div class="card"><h2>Discount Settings</h2><div class="form-grid" style="margin-top:25px"><div class="field"><label>Product / Batch</label><select id="discountAlert">${alerts.map(a=>`<option value="${a.id}" ${state.discountAlertId===a.id?'selected':''}>${escapeHtml(a.product)} · ${escapeHtml(a.batch)} · ${a.risk}% risk</option>`).join("")||'<option value="">No stored batches with predictions</option>'}</select></div><div class="field"><label>Original Price (₹/kg)</label><input id="discountOriginal" type="number" value="25" step="0.1" min="0.1"></div><div class="field"><label>Discount (%)</label><input id="discountPercent" type="number" value="20" min="0" max="95" oninput="updateDiscountPreview()"></div><div class="field"><label>Discounted Price (₹/kg)</label><input id="discountPrice" type="number" value="20" step="0.1" min="0.1" oninput="updateDiscountPercent()"></div></div><div class="discount-preview" id="discountPreview">Discounted selling price: <b>₹20.00/kg</b></div><button class="btn btn-primary" style="margin-top:20px" ${alerts.length?"":"disabled style='opacity:.5'"} onclick="saveDiscount()">List at Discounted Price</button></div>
  <div class="card section-card"><div class="section-header"><h2>Discounted Listings</h2></div>${discounts.length?discounts.map(d=>`<div class="product-row"><div class="product-icon">%</div><div class="product-info"><b>${escapeHtml(d.product)} · ${escapeHtml(d.batchId)}</b><span>₹${Number(d.originalPrice).toFixed(2)} → ₹${Number(d.discountedPrice).toFixed(2)}/kg · ${d.discountPercent}% off</span></div><span class="pill green">Visible to Buyers</span></div>`).join(""):emptyState("No discounts yet","Use this section to adjust the price of an accepted stored batch.","storage","View My Storage")}</div>`;
}
function updateDiscountPreview(){const original=Number(document.getElementById("discountOriginal")?.value||0),pct=Math.min(95,Math.max(0,Number(document.getElementById("discountPercent")?.value||0))),price=original*(1-pct/100);const p=document.getElementById("discountPrice");if(p)p.value=price.toFixed(2);const box=document.getElementById("discountPreview");if(box)box.innerHTML=`Discounted selling price: <b>₹${price.toFixed(2)}/kg</b>`;}
function updateDiscountPercent(){const o=Number(document.getElementById("discountOriginal")?.value||0),p=Number(document.getElementById("discountPrice")?.value||0),pct=o?Math.max(0,Math.min(95,(1-p/o)*100)):0;const x=document.getElementById("discountPercent");if(x)x.value=pct.toFixed(0);const box=document.getElementById("discountPreview");if(box)box.innerHTML=`Discounted selling price: <b>₹${p.toFixed(2)}/kg</b>`;}
function saveDiscount(){
  const alerts=readStore("alerts",[]),a=alerts.find(x=>x.id===document.getElementById("discountAlert")?.value),stored=acceptedProducts();
  const p=stored.find(x=>x.batchId===a?.batch);
  if(!a||!p)return alert("Select an at-risk accepted/stored batch first.");
  const original=Number(document.getElementById("discountOriginal").value),discounted=Number(document.getElementById("discountPrice").value),pct=Number(document.getElementById("discountPercent").value);
  if(!original||!discounted||discounted<=0||discounted>=original)return alert("Discounted price must be positive and lower than the original price.");
  const discounts=readStore("discounts",[]),record={id:uid("DSC"),product:p.product,batchId:p.batchId,quantity:p.quantity,originalPrice:original,discountedPrice:discounted,discountPercent:pct,createdAt:Date.now()};
  discounts.unshift(record);writeStore("discounts",discounts);
  migrateMarketplace();
  const listings=globalMarketplace().filter(l=>!(l.batchId===p.batchId&&l.seller===state.user&&l.discountedPrice));
  listings.unshift({id:uid("LST"),product:p.product,batchId:p.batchId,quantity:p.quantity,price:discounted,originalPrice:original,discountedPrice:discounted,discountPercent:pct,status:"Active",seller:state.user,sellerRole:"Farmer",createdAt:Date.now()});
  writeGlobalMarketplace(listings);
  addNotification("Product listed at discount",`${p.product} · ${p.batchId} is now visible to buyers at ₹${discounted.toFixed(2)}/kg (${pct}% off).`);
  render();
}

function paymentsPage(){const payments=readStore("payments",[]);return `<div class="page-head"><div class="page-icon">▭</div><div><h1>Payments</h1><p>Track payments made by the farmer to cold storage and travel partners.</p></div></div>${payments.length?payments.map(p=>`<div class="card payment-record"><div class="payment-icon">✓</div><div class="payment-main"><b>${escapeHtml(p.type)} Payment</b><span>${escapeHtml(p.product)} · ${escapeHtml(p.batchId)}</span><small>Paid to: ${escapeHtml(p.payee)} · ${escapeHtml(p.method)} · ${new Date(p.createdAt).toLocaleString()}</small></div><strong>₹${Number(p.amount).toLocaleString()}</strong><span class="pill green">Paid</span></div>`).join(""):emptyState("No payments yet","Your storage and transportation payments will appear here after checkout.","book","Book Storage")}`;}

function notificationsPage(){const ns=readStore("notifications",[]);return `<div class="page-head"><div class="page-icon">♧</div><div><h1>Notifications</h1><p>Updates stay here even after the popup disappears.</p></div><div class="head-actions"><button class="btn btn-outline" onclick="deleteAllNotifications()">Delete all</button></div></div><div class="notification-list">${ns.length?ns.map(n=>`<div class="notice ${n.type||''}"><div><b>${escapeHtml(n.title)}</b><p>${escapeHtml(n.message)}</p><small>${new Date(n.createdAt).toLocaleString()}</small></div><button class="notice-delete" onclick="deleteNotification('${n.id}')">Delete</button></div>`).join(""):emptyState("No notifications","New bookings, payments, pickup assignments and alerts will appear here.","dashboard","Go to Dashboard")}</div>`;}
function deleteNotification(id){writeStore("notifications",readStore("notifications",[]).filter(n=>n.id!==id));render();}
function deleteAllNotifications(){writeStore("notifications",[]);render();}

function invoices(){const payments=readStore("payments",[]);return `<div class="page-head"><div class="page-icon">▤</div><div><h1>Invoices</h1><p>Download invoices for your bookings and payments.</p></div></div><div class="invoices">${payments.length?payments.map((p,i)=>invoice(`INV-${p.id.slice(-9)}`,`${p.product} · ${Number(p.quantity).toLocaleString()} kg`,`${p.payee} · ${new Date(p.createdAt).toLocaleDateString()}`,`₹${Number(p.amount).toLocaleString()}`)).join(""):invoice("INV-5282485092","Potato · 1000 kg","Yamuna Cold Chain · 2026-09-15","₹7,250")}</div>`;}
function invoice(no,a,b,total){return `<div class="card invoice-card"><span class="paid">Paid</span><div class="product-icon">▤</div><div class="invoice-number">${no}</div><div style="margin-top:10px">${a}<br><span style="color:var(--muted)">${b}</span></div><hr><div class="invoice-bottom"><b>${total}</b><button class="btn btn-outline" onclick="downloadInvoice('${no}')">⇩　Download Invoice</button></div></div>`;}

function storagePage(){
  const stored=acceptedProducts(), bookings=readStore("bookings",[]).filter(isAcceptedBooking);
  return `<div class="page-head"><div class="page-icon">📦</div><div><h1>My Storage</h1><p>View accepted storage bookings, stored batches and live cold-chain conditions.</p></div></div>
  ${stored.length?stored.map(p=>`<div class="card storage-batch-card"><div class="storage-batch-head"><div><h2>${escapeHtml(p.product)} · ${escapeHtml(p.batchId)}</h2><p>${Number(p.quantity).toLocaleString()} kg · ${escapeHtml(p.storage)} · <b>Accepted by Cold Storage</b></p></div><span class="pill green">Stored</span></div><div class="sensor-live-grid"><div><span>Temperature</span><b class="live-temp-${escapeAttr(p.batchId)}">—</b></div><div><span>Humidity</span><b class="live-hum-${escapeAttr(p.batchId)}">—</b></div><div><span>NDIR CO₂</span><b class="live-co2-${escapeAttr(p.batchId)}">—</b></div><div><span>Storage</span><b>${escapeHtml(p.storage)}</b></div></div><div class="storage-batch-actions"><button class="btn btn-outline" onclick="navigate('monitor')">View Live Monitoring</button><button class="btn btn-outline" onclick="navigate('alerts')">Spoilage Alerts</button><button class="btn btn-primary" onclick="navigate('discounts')">Discount / Sell</button></div></div>`).join(""):emptyState("No accepted storage batches","A product appears here only after its cold-storage booking is accepted.","book","Book Storage")}
  ${bookings.length?`<div class="card section-card"><div class="section-header"><h2>Accepted Storage Bookings</h2></div>${bookings.map(bookingTimeline).join("")}</div>`:""}`;
}
function monitoringStorageOptions(stored){
  // Show every cold storage available to this farmer for booking, not only
  // storages that currently have an accepted batch. This lets the farmer
  // select any storage and clearly see when nothing is stored there yet.
  const map=new Map();
  storageOptions.forEach(s=>{
    const id=`${s.name.replace(/\s+/g,"-").toLowerCase()}`;
    map.set(id,{id,name:s.name,location:s.location});
  });
  // Preserve any accepted storage that may have been added dynamically.
  stored.forEach(p=>{
    const id=p.storageId||p.storage||"storage";
    if(!map.has(id)) map.set(id,{id,name:p.storage||"Cold Storage",location:p.storageLocation||""});
  });
  return [...map.values()];
}
function selectedMonitoringStorage(stored){
  const options=monitoringStorageOptions(stored);
  if(!options.length)return null;
  const wanted=state.selectedMonitorStorageId||options[0].id;
  return options.find(x=>x.id===wanted)||options[0];
}
function productsForMonitoringStorage(stored, storageId){
  return stored.filter(p=>(p.storageId||p.storage||"storage")===storageId);
}
function trendKey(batchId, metric){return `${batchId}:${metric}`;}
function pushTrend(batchId, metric, value){
  const k=trendKey(batchId,metric);
  const arr=state.monitorHistory[k]||(state.monitorHistory[k]=[]);
  arr.push(Number(value));
  if(arr.length>18)arr.splice(0,arr.length-18);
  return arr;
}
function sparkline(values, unit, cls){
  if(!values.length)return `<div class="trend-empty">Waiting for live sensor data…</div>`;
  const w=520,h=150,p=10,min=Math.min(...values),max=Math.max(...values),range=max-min||1;
  const pts=values.map((v,i)=>`${p+(i*(w-p*2)/Math.max(1,values.length-1))},${h-p-((v-min)/range)*(h-p*2)}`).join(" ");
  const last=values[values.length-1];
  return `<div class="trend-wrap ${cls}"><div class="trend-current">${Number(last).toFixed(metricDecimals(unit))}${unit}</div><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="Live ${unit} trend"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="trend-axis"><span>Older</span><span>Live</span></div></div>`;
}
function metricDecimals(unit){return unit==='°C'?1:0;}
function monitoringMetricCard(title, sensor, batchId, metric, unit, iconClass){
  const vals=state.monitorHistory[trendKey(batchId,metric)]||[];
  return `<div class="trend-card"><div class="trend-head"><div><span>${title}</span><small>${sensor}</small></div><b class="trend-icon ${iconClass}">${metric==='temperature'?'♨':metric==='humidity'?'◌':'CO₂'}</b></div>${sparkline(vals,unit,iconClass)}</div>`;
}
function dashboardMonitoringSection(stored){
  const options=monitoringStorageOptions(stored), selected=selectedMonitoringStorage(stored);
  if(!selected)return `<div class="card section-card monitoring-dashboard"><div class="section-header"><div><h2>${t("Storage Monitoring")}</h2><p class="muted">${t("Live trends become available after a cold-storage booking is accepted.")}</p></div><button class="btn btn-outline" onclick="navigate('monitor')">${t("Open Monitoring")}</button></div><div class="empty-monitor">${t("No accepted stored produce to monitor yet.")}</div></div>`;
  const items=productsForMonitoringStorage(stored,selected.id);
  return `<div class="card section-card monitoring-dashboard"><div class="section-header"><div><h2>${t("Storage Monitoring")}</h2><p class="muted">${t("Live temperature, humidity and NDIR CO₂ trends for accepted stored produce.")}</p></div><div class="monitor-head-actions"><select class="monitor-storage-select" aria-label="${t("Select Cold Storage")}" onchange="selectMonitorStorage(this.value)">${options.map(o=>`<option value="${escapeAttr(o.id)}" ${o.id===selected.id?'selected':''}>${escapeHtml(o.name)}${o.location?` · ${escapeHtml(o.location)}`:''}</option>`).join('')}</select><button class="btn btn-outline" onclick="navigate('monitor')">${t("View Live Monitoring")}</button></div></div>${items.length?`<div class="dashboard-trends">${items.slice(0,1).map(p=>`${monitoringMetricCard(t('Temperature'),'PT100 RTD',p.batchId,'temperature','°C','temp')}${monitoringMetricCard(t('Humidity'),'Industrial humidity sensor',p.batchId,'humidity','%','hum')}${monitoringMetricCard(t('NDIR CO₂'),'NDIR CO₂ sensor',p.batchId,'co2',' ppm','co2')}`).join('')}</div>`:`<div class="empty-monitor">${t("You have not stored any produce in this cold storage yet.")}</div>`}</div>`;
}
function monitoringPage(){
  const stored=acceptedProducts(), options=monitoringStorageOptions(stored), selected=selectedMonitoringStorage(stored);
  if(!selected)return `<div class="page-head"><div class="page-icon">♧</div><div><h1>${t("Monitoring")}</h1><p>${t("Live temperature, humidity and NDIR CO₂ monitoring for your stored produce.")}</p></div></div>${emptyState(t("Nothing to monitor"),t("Live monitoring starts only after a cold-storage booking is accepted and the produce is stored."),"storage",t("View My Storage"))}`;
  const items=productsForMonitoringStorage(stored,selected.id);
  return `<div class="page-head"><div class="page-icon">♧</div><div><h1>${t("Storage Monitoring")}</h1><p>${t("Live sensors, camera feed and AI spoilage prediction.")}</p></div></div><div class="card monitor-storage-picker"><div><h3>${t("Select Cold Storage")}</h3><p>${t("Choose the cold storage where you want to see live conditions.")}</p></div><select class="monitor-storage-select large" aria-label="${t("Select Cold Storage")}" onchange="selectMonitorStorage(this.value)">${options.map(o=>`<option value="${escapeAttr(o.id)}" ${o.id===selected.id?'selected':''}>${escapeHtml(o.name)}${o.location?` · ${escapeHtml(o.location)}`:''}</option>`).join('')}</select></div><div class="monitor-location">⌖ ${escapeHtml(selected.name)} · <span>${t("Live")}</span></div>${items.length?items.map(p=>`<div class="card monitoring-card" data-monitor-batch="${escapeAttr(p.batchId)}"><div class="section-header"><div><h2>${escapeHtml(p.product)} · ${escapeHtml(p.batchId)}</h2><p class="muted">${escapeHtml(p.storage)} · <span class="live-dot">● ${t("Live")}</span></p></div><span class="pill green">${t("Accepted & Stored")}</span></div><div class="dashboard-trends full">${monitoringMetricCard(t('Temperature'),'PT100 RTD',p.batchId,'temperature','°C','temp')}${monitoringMetricCard(t('Humidity'),'Industrial humidity sensor',p.batchId,'humidity','%','hum')}${monitoringMetricCard(t('NDIR CO₂'),'NDIR CO₂ sensor',p.batchId,'co2',' ppm','co2')}</div><div class="monitor-camera"><span>${t("Camera feed")}</span><b id="monitor-camera-${escapeAttr(p.batchId)}">${t("Checking…")}</b><small>${t("Visual spoilage observation associated with batch")} ${escapeHtml(p.batchId)}</small></div><p class="monitor-note">${t("Sensor and camera data are associated with batch")} <b>${escapeHtml(p.batchId)}</b> ${t("and are used by the spoilage-risk prediction.")}</p></div>`).join(''):`<div class="card empty-state"><h3>${t("You have not stored any produce in this cold storage yet.")}</h3><p>${t("Select another cold storage to view its accepted stored produce and live conditions.")}</p><button class="btn btn-primary" onclick="navigate('book')">${t("Book Storage")}</button></div>`}`;
}
function refreshLiveMonitoring(){
  const stored=acceptedProducts();
  stored.forEach(p=>{
    const s=sensorSnapshot(p.batchId), camera=Math.random()>.7?"Early spoilage signs detected":"No visible spoilage detected";
    pushTrend(p.batchId,'temperature',s.temperature);pushTrend(p.batchId,'humidity',s.humidity);pushTrend(p.batchId,'co2',s.co2);
    const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
    set(`monitor-camera-${p.batchId}`,camera);set(`live-temp-${p.batchId}`,`${s.temperature}°C`);set(`live-hum-${p.batchId}`,`${s.humidity}%`);set(`live-co2-${p.batchId}`,`${s.co2} ppm`);
    const card=document.querySelector(`[data-monitor-batch="${CSS.escape(String(p.batchId))}"]`);
    if(card){
      const selectedBatch=card.querySelector('.dashboard-trends');
      if(selectedBatch)selectedBatch.innerHTML=`${monitoringMetricCard('Temperature','PT100 RTD',p.batchId,'temperature','°C','temp')}${monitoringMetricCard('Humidity','Industrial humidity sensor',p.batchId,'humidity','%','hum')}${monitoringMetricCard('NDIR CO₂','NDIR CO₂ sensor',p.batchId,'co2',' ppm','co2')}`;
    }
    const dash=document.querySelector('.monitoring-dashboard .dashboard-trends');
    if(dash){const first=stored[0]; if(first){dash.innerHTML=`${monitoringMetricCard('Temperature','PT100 RTD',first.batchId,'temperature','°C','temp')}${monitoringMetricCard('Humidity','Industrial humidity sensor',first.batchId,'humidity','%','hum')}${monitoringMetricCard('NDIR CO₂','NDIR CO₂ sensor',first.batchId,'co2',' ppm','co2')}`;}}
  });
}
function selectMonitorStorage(id){state.selectedMonitorStorageId=id;render();}

function coldStorageBookings(){
  const name=normalizeName(coldStorageName());
  return globalBookings().filter(b=>normalizeName(b.storage)===name);
}
function coldStorageDashboard(){
  const bookings=coldStorageBookings(), pending=bookings.filter(b=>b.status==="PENDING").length, accepted=bookings.filter(isAcceptedBooking).length, kg=bookings.filter(isAcceptedBooking).reduce((a,b)=>a+Number(b.quantity||0),0);
  return `<div class="page-head"><div class="page-icon">▤</div><div><h1>Dashboard</h1><p>${escapeHtml(coldStorageName()||"Cold Storage")} · Cold storage operations</p></div></div><div class="cards">${metric("▤",`${kg.toLocaleString()} kg`,"Occupied")}${metric("▱",`${pending}`,"Pending Requests","blue")}${metric("◇",`${accepted}`,"Accepted Bookings","purple")}${metric("♧",`${bookings.length}`,"Total Bookings","green")}</div><div class="card section-card"><div class="section-header"><h2>Booking Requests</h2><button class="link-btn" onclick="navigate('requests')">View all</button></div>${bookings.length?bookings.slice(0,4).map(coldBookingRow).join(""):emptyState("No pending requests","Farmer booking requests for this cold storage will appear here.","requests","View Requests")}</div>`;
}
function coldBookingRow(b){return `<div class="product-row"><div class="product-icon">▱</div><div class="product-info"><b>${escapeHtml(b.product)} · ${escapeHtml(b.batchId)}</b><span>${Number(b.quantity).toLocaleString()} kg · Farmer: ${escapeHtml(b.farmerName||b.farmerUser||"Farmer")}</span></div><span class="pill ${isAcceptedBooking(b)?'green':''}">${escapeHtml(b.status||"PENDING")}</span></div>`;}
function bookingRequestsPage(){
  const bookings=coldStorageBookings();
  return `<div class="page-head"><div class="page-icon">▱</div><div><h1>Booking Requests</h1><p>Requests appear here when a farmer books <b>${escapeHtml(coldStorageName()||"this cold storage")}</b>.</p></div></div>${bookings.length?bookings.map(b=>`<div class="card booking-request-card"><div class="section-header"><div><h2>${escapeHtml(b.product)} · ${escapeHtml(b.batchId)}</h2><p>Farmer: <b>${escapeHtml(b.farmerName||b.farmerUser||"Farmer")}</b> · ${Number(b.quantity).toLocaleString()} kg</p><p>Requested storage: ${escapeHtml(b.storage)}</p></div><span class="pill ${isAcceptedBooking(b)?'green':''}">${escapeHtml(b.status||"PENDING")}</span></div>${b.status==="PENDING"?`<div class="risk-actions"><button class="btn btn-primary" onclick="acceptBooking('${b.id}')">Accept Booking</button><button class="btn btn-outline" onclick="rejectBooking('${b.id}')">Reject Booking</button></div>`:`<p style="color:var(--muted)">Accepted on ${new Date(b.acceptedAt||b.createdAt).toLocaleString()}.</p>`}</div>`).join(""):emptyState("No pending requests","No booking requests match this cold storage name.","dashboard","Go to Dashboard")}`;
}
function coldStockPage(kind){
  const bookings=coldStorageBookings().filter(isAcceptedBooking), title=kind==="incoming"?"Incoming Stock":"Stored Stock";
  return `<div class="page-head"><div class="page-icon">${kind==="incoming"?'◇':'▤'}</div><div><h1>${title}</h1><p>${kind==="incoming"?'Accepted farmer bookings awaiting stock arrival.':'Produce currently accepted and stored in this cold storage.'}</p></div></div>${bookings.length?bookings.map(b=>`<div class="card product-row"><div class="product-icon">◇</div><div class="product-info"><b>${escapeHtml(b.product)} · ${escapeHtml(b.batchId)}</b><span>${Number(b.quantity).toLocaleString()} kg · Farmer: ${escapeHtml(b.farmerName||b.farmerUser||"Farmer")}</span></div><span class="pill green">Accepted</span></div>`).join(""):emptyState(kind==="incoming"?"No incoming stock":"No stored stock",kind==="incoming"?"Accepted bookings will appear here when the farmer's stock is assigned to this storage.":"Accepted produce will appear here after the cold storage accepts the booking.","requests","View Requests")}`;
}
function coldPricePage(){return `<div class="page-head"><div class="page-icon">◇</div><div><h1>Price Listing</h1><p>Manage storage-side price information for your cold storage.</p></div></div><div class="card"><h2>${escapeHtml(coldStorageName()||"Cold Storage")}</h2><p style="color:var(--muted);font-size:18px">Price listing controls are connected to this cold-storage account.</p></div>`;}
function profilePage(){
  const a=currentAccount();
  return `<div class="page-head"><div class="page-icon">♙</div><div><h1>Profile</h1><p>Your profile and account details.</p></div></div><div class="card profile-card"><div class="profile-header"><div class="profile-avatar">${escapeHtml((a.name||state.user||"U").slice(0,2).toUpperCase())}</div><div><h2>${escapeHtml(a.name||state.user||"User")}</h2><p>${escapeHtml(state.role)}</p></div></div><div class="form-grid" style="margin-top:25px"><div class="field"><label>Full Name</label><input id="profileName" value="${escapeAttr(a.name||"")}"></div><div class="field"><label>Phone Number</label><input id="profilePhone" value="${escapeAttr(a.phone||"")}"></div><div class="field"><label>Email</label><input id="profileEmail" value="${escapeAttr(a.email||state.user)}" disabled></div>${state.role==="Cold Storage"?`<div class="field"><label>Storage Name</label><input id="profileStorageName" value="${escapeAttr(a.storageName||a.name||"")}" placeholder="e.g. Yamuna Cold Chain"></div>`:""}</div><button class="btn btn-primary" style="margin-top:22px" onclick="saveProfile()">Save Changes</button></div>`;
}
function saveProfile(){
  const a=currentAccount(); a.name=document.getElementById("profileName")?.value.trim()||a.name; a.phone=document.getElementById("profilePhone")?.value.trim()||a.phone; if(state.role==="Cold Storage")a.storageName=document.getElementById("profileStorageName")?.value.trim()||a.storageName||a.name; localStorage.setItem(`agrisetuAccount_${state.user}`,JSON.stringify(a)); localStorage.setItem(`agrisetuRole_${state.user}`,state.role); addNotification("Profile updated","Your profile changes have been saved.","info"); render();
}
function acceptBooking(id){
  const all=globalBookings(), b=all.find(x=>x.id===id); if(!b)return; b.status="ACCEPTED";b.storageAccepted=true;b.acceptedAt=Date.now();b.step=5;writeGlobalBookings(all);
  const farmerBookings=JSON.parse(localStorage.getItem(keyForUser("bookings",b.farmerUser))||"[]"); const fb=farmerBookings.find(x=>x.id===id); if(fb)Object.assign(fb,{status:"ACCEPTED",storageAccepted:true,acceptedAt:b.acceptedAt,step:5}); else farmerBookings.unshift({...b,farmerUser:undefined}); localStorage.setItem(keyForUser("bookings",b.farmerUser),JSON.stringify(farmerBookings));
  const products=JSON.parse(localStorage.getItem(keyForUser("products",b.farmerUser))||"[]"); const p=products.find(x=>x.batchId===b.batchId); if(p){p.storageAccepted=true;p.storageAcceptedAt=b.acceptedAt;p.storage=b.storage;p.storageId=b.storageId;p.bookingId=b.id;} localStorage.setItem(keyForUser("products",b.farmerUser),JSON.stringify(products));
  const farmerNotices=JSON.parse(localStorage.getItem(keyForUser("notifications",b.farmerUser))||"[]"); farmerNotices.unshift({id:uid("NTF"),title:"Storage booking accepted",message:`${b.storage} accepted ${b.product} (${Number(b.quantity).toLocaleString()} kg). Live monitoring is now active.`,type:"info",createdAt:Date.now()});localStorage.setItem(keyForUser("notifications",b.farmerUser),JSON.stringify(farmerNotices.slice(0,50)));
  addNotification("Booking accepted",`${b.product} for ${b.farmerName||b.farmerUser} has been accepted.`,"info"); render();
}
function rejectBooking(id){const all=globalBookings(),b=all.find(x=>x.id===id);if(!b)return;b.status="REJECTED";b.storageAccepted=false;b.rejectedAt=Date.now();writeGlobalBookings(all);const farmerBookings=JSON.parse(localStorage.getItem(keyForUser("bookings",b.farmerUser))||"[]");const fb=farmerBookings.find(x=>x.id===id);if(fb)Object.assign(fb,{status:"REJECTED",storageAccepted:false});localStorage.setItem(keyForUser("bookings",b.farmerUser),JSON.stringify(farmerBookings));const farmerNotices=JSON.parse(localStorage.getItem(keyForUser("notifications",b.farmerUser))||"[]");farmerNotices.unshift({id:uid("NTF"),title:"Storage booking rejected",message:`${b.storage} rejected the booking for ${b.product}.`,type:"danger",createdAt:Date.now()});localStorage.setItem(keyForUser("notifications",b.farmerUser),JSON.stringify(farmerNotices.slice(0,50)));addNotification("Booking rejected",`${b.product} booking rejected.`,"danger");render();}
function coldMonitorPage(){
  const bookings=coldStorageBookings().filter(isAcceptedBooking);
  return `<div class="page-head"><div class="page-icon">♧</div><div><h1>Monitoring</h1><p>Live temperature, humidity and NDIR CO₂ monitoring for produce stored at ${escapeHtml(coldStorageName()||"this cold storage")}.</p></div></div>${bookings.length?bookings.map(b=>{const s=sensorSnapshot(b.batchId);return `<div class="card monitoring-card"><div class="section-header"><div><h2>${escapeHtml(b.product)} · ${escapeHtml(b.batchId)}</h2><p class="muted">Farmer: ${escapeHtml(b.farmerName||b.farmerUser||"Farmer")} · <span class="live-dot">● Live</span></p></div><span class="pill green">Accepted & Stored</span></div><div class="dashboard-trends full">${monitoringMetricCard("Temperature","PT100 RTD",b.batchId,"temperature","°C","temp")}${monitoringMetricCard("Humidity","Industrial humidity sensor",b.batchId,"humidity","%","hum")}${monitoringMetricCard("NDIR CO₂","NDIR CO₂ sensor",b.batchId,"co2"," ppm","co2")}</div><div class="monitor-camera"><span>Camera feed</span><b>No visible spoilage detected</b><small>Visual spoilage observation associated with batch ${escapeHtml(b.batchId)}</small></div></div>`;}).join(""):emptyState("Nothing to monitor","Accepted bookings will appear here after this cold storage accepts a farmer's booking.","requests","View Booking Requests")}`;
}
function genericPage(){
  if(state.role==="Cold Storage"){if(state.page==="requests")return bookingRequestsPage();if(state.page==="incoming")return coldStockPage("incoming");if(state.page==="stored")return coldStockPage("stored");if(state.page==="price")return coldPricePage();if(state.page==="profile")return profilePage();if(state.page==="dashboard")return coldStorageDashboard();}
  if(state.page==="profile")return profilePage();
  if(state.page==="storage")return storagePage();
  if(state.page==="monitor" && state.role==="Cold Storage")return coldMonitorPage();
  if(state.page==="monitor")return monitoringPage();
  if(state.page==="products")return productsPage();
  if(state.page==="market")return marketplacePage();
  if(state.page==="alerts")return alertsPage();
  if(state.page==="discounts")return discountsPage();
  if(state.page==="payments")return paymentsPage();
  if(state.page==="notifications")return notificationsPage();
  const data={storage:["My Storage","View your active storage bookings and stored batches.","📦"],monitor:["Monitoring","Real-time temperature, humidity and storage health.","♧"]};
  const [title,sub,ic]=data[state.page]||[pageTitle(),"Your farmer portal section is ready.","▤"];
  return `<div class="page-head"><div class="page-icon">${ic}</div><div><h1>${title}</h1><p>${sub}</p></div></div><div class="card"><h2>${title}</h2><p style="color:var(--muted);font-size:18px">This section is connected to your farmer account and local prototype data.</p></div>`;
}

let liveMonitoringTimer=null;
function render(){
  if(liveMonitoringTimer){clearInterval(liveMonitoringTimer);liveMonitoringTimer=null;}
  seedUserData();
  if(!state.loggedIn){app.innerHTML=state.page==="login"?login():state.page==="register"?registerPage():landing();return;}
  let content=state.page==="dashboard"&&state.role!=="Cold Storage"?dashboard():state.page==="book"?book():state.page==="invoices"?invoices():genericPage();
  app.innerHTML=shell(content);
  applyLanguage();
  renderNotificationBadge();
  if(state.page==="monitor"||state.page==="storage"||state.page==="dashboard"){
    refreshLiveMonitoring();
    liveMonitoringTimer=setInterval(refreshLiveMonitoring,3000);
  }
}
function showLogin(){state.page="login";render();}
function showRegister(){state.page="register";render();}
function selectRole(r){state.role=r;render();}
function selectRegisterRole(r){state.role=r;render();}
function doRegister(){
  const name=document.getElementById("registerName").value.trim(),phone=document.getElementById("registerPhone").value.trim(),email=document.getElementById("registerEmail").value.trim().toLowerCase(),password=document.getElementById("registerPassword").value,confirm=document.getElementById("registerConfirm").value,err=document.getElementById("registerError");
  const storageName=state.role==="Cold Storage"?(document.getElementById("registerStorageName")?.value||"").trim():"";
  if(!name||!phone||!email||!password||!confirm||(state.role==="Cold Storage"&&!storageName)){err.innerHTML='<div class="error">Please fill in all fields and select your cold storage name.</div>';return;}
  if(password!==confirm){err.innerHTML='<div class="error">Passwords do not match.</div>';return;}
  if(password.length<6){err.innerHTML='<div class="error">Password must be at least 6 characters.</div>';return;}
  if(localStorage.getItem(`agrisetuPassword_${email}`)){err.innerHTML='<div class="error">An account with this email already exists. Please log in.</div>';return;}
  localStorage.setItem(`agrisetuPassword_${email}`,password);
  localStorage.setItem(`agrisetuAccount_${email}`,JSON.stringify({name,phone,email,role:state.role,storageName:storageName||undefined}));
  localStorage.setItem(`agrisetuRole_${email}`,state.role);
  localStorage.setItem("agrisetuUser",email);
  state.user=email;
  state.loggedIn=true;
  state.page="dashboard";
  seedUserData();
  addNotification("Account created",`Welcome to Agrisetu, ${name}.`);
  render();
}
function doLogin(){
  const email=document.getElementById("email").value.trim().toLowerCase(),password=document.getElementById("password").value,err=document.getElementById("loginError");
  if(!email||!password){err.innerHTML='<div class="error">Please enter your email and password.</div>';return;}
  const existing=localStorage.getItem(`agrisetuPassword_${email}`);
  if(existing&&existing!==password){err.innerHTML='<div class="error">Invalid email or password.</div>';return;}
  const accountRaw=localStorage.getItem(`agrisetuAccount_${email}`);
  if(accountRaw){try{const account=JSON.parse(accountRaw);state.role=account.role||state.role;}catch{}}
  localStorage.setItem(`agrisetuPassword_${email}`,password);localStorage.setItem("agrisetuUser",email);sessionStorage.setItem("agrisetuSession","true");state.user=email;state.loggedIn=true;state.page="dashboard";seedUserData();render();
}
function logout(){state.loggedIn=false;state.page="landing";sessionStorage.removeItem("agrisetuSession");render();}
function navigate(p){state.page=p;if(p!=="book")state.bookingStep=1;if(p==="notifications")setTimeout(renderNotificationBadge,0);render();if(document.getElementById("sidebar")?.classList.contains("open"))toggleSidebar();}
function nextBooking(n){state.bookingStep=n;if(n===4&&!state.otp)state.otp=String(Math.floor(100000+Math.random()*900000));render();}
function chooseStorage(i){state.selectedStorage=i;render();}
function choosePorter(i){state.selectedPorter=i;render();}
function toggleSidebar(){document.getElementById("sidebar")?.classList.toggle("open");document.getElementById("sidebarOverlay")?.classList.toggle("open");}

function openPayment(){const s=storageOptions[state.selectedStorage??2],p=porterOptions[state.selectedPorter??0],total=s.cost+p.price;let modal=document.getElementById("paymentModal");if(!modal){modal=document.createElement("div");modal.className="modal-backdrop";modal.id="paymentModal";document.body.appendChild(modal);}renderPaymentModal(total,s,p,modal);}
function renderPaymentModal(total,s,p,modal){modal.innerHTML=`<div class="modal"><div class="modal-head"><h2>Payment</h2><button class="close" onclick="closePayment()">×</button></div><div class="payer">Payer: ${escapeHtml(state.user)}</div><div class="charges"><div class="charge"><span>Storage Charges</span><b>₹${s.cost.toLocaleString()}</b></div><div class="charge"><span>Transportation Charges</span><b>₹${p.price.toLocaleString()}</b></div><div class="charge total"><span>Total Amount</span><b>₹${total.toLocaleString()}</b></div></div><h3 style="margin-top:32px">Payment Method</h3><div class="methods">${["UPI","Card","Net Banking"].map(x=>`<button type="button" class="method ${state.paymentMethod===x?'selected':''}" onclick="selectPaymentMethod('${x}')"><span>${x==="UPI"?"▯":x==="Card"?"▭":"▤"}</span>${x}</button>`).join("")}</div><button type="button" class="btn btn-primary" style="width:100%" onclick="completePayment(${total})">Pay ₹${total.toLocaleString()}</button></div>`;}
function selectPaymentMethod(method){state.paymentMethod=method;const modal=document.getElementById("paymentModal");if(modal){const s=storageOptions[state.selectedStorage??2],p=porterOptions[state.selectedPorter??0],total=s.cost+p.price;renderPaymentModal(total,s,p,modal);}}
function closePayment(){document.getElementById("paymentModal")?.remove();}
function completePayment(total){const modal=document.getElementById("paymentModal");modal.innerHTML=`<div class="modal success"><div class="modal-head"><h2>Payment Successful</h2><button class="close" onclick="closePayment()">×</button></div><p style="color:var(--muted);font-size:18px">Your payment has been processed.</p><div class="success-check">✓</div><h3>✓ Payment Successful</h3><p>Amount paid: ₹${total.toLocaleString()} via ${state.paymentMethod}</p><button class="btn btn-primary" style="width:100%;margin-top:35px" onclick="finishBooking(${total})">Done</button></div>`;}
function finishBooking(total){
  const s=storageOptions[state.selectedStorage??2],p=porterOptions[state.selectedPorter??0],product=state.bookingProduct||"Potato",quantity=state.bookingQuantity||1000,batchId=state.batchId||`${product.slice(0,3).toUpperCase()}-${Math.floor(1000+Math.random()*9000)}`;
  const booking={id:uid("BKG"),product,quantity,batchId,storage:s.name,storageId:`${s.name.replace(/\s+/g,"-").toLowerCase()}`,porter:p.name,step:1,status:"PENDING",storageAccepted:false,farmerUser:state.user,farmerName:currentAccount().name||state.user,pickupDate:state.bookingDate||"TBD",createdAt:Date.now()};
  const bookings=readStore("bookings",[]);bookings.unshift(booking);writeStore("bookings",bookings);
  const global=globalBookings();global.unshift({...booking});writeGlobalBookings(global);notifyMatchingColdStorages(booking);
  const products=readStore("products",[]),existing=products.find(x=>x.batchId===batchId);
  if(existing){existing.storage=s.name;existing.storageId=booking.storageId;existing.storageAccepted=false;existing.bookingId=booking.id;}
  else products.unshift({id:uid("PRD"),product,quantity,location:state.bookingLocation||"Agra",batchId,storage:s.name,storageId:booking.storageId,storageAccepted:false,bookingId:booking.id,createdAt:Date.now()});
  writeStore("products",products);
  const payments=readStore("payments",[]);payments.unshift({id:uid("PAY"),type:"Storage",product,quantity,batchId,amount:s.cost,method:state.paymentMethod,payee:s.name,createdAt:Date.now()});payments.unshift({id:uid("PAY"),type:"Transportation",product,quantity,batchId,amount:p.price,method:state.paymentMethod,payee:p.name,createdAt:Date.now()});writeStore("payments",payments);
  addNotification("New booking",`${state.user} booked ${Number(quantity).toLocaleString()} kg of ${product} at ${s.name}.`);
  addNotification("✓ Payment completed",`Payment successful. Invoice generated. Awaiting ${s.name} acceptance.`);
  closePayment();state.paymentDone=true;state.bookingStep=1;state.selectedStorage=null;state.selectedPorter=null;state.page="storage";render();
}
function downloadInvoice(no){const blob=new Blob([`AGR ISETU INVOICE\n\nInvoice: ${no}\nFarmer: ${state.user}\nStatus: Paid\n`],{type:"text/plain"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=no+".txt";a.click();URL.revokeObjectURL(a.href);}
function timeAgo(ts){const m=Math.max(1,Math.round((Date.now()-ts)/60000));return m<60?`${m} min ago`:m<1440?`${Math.round(m/60)}h ago`:`${Math.round(m/1440)}d ago`;}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function escapeAttr(s){return escapeHtml(s).replace(/`/g,"&#096;");}

render();

/* ============================================================
   TRAVEL PARTNER / BUYER BOOKING ADD-ON
   Appended only: existing UI/workflows are preserved.
   ============================================================ */

function partnerAccountName(){
  const a=currentAccount();
  return a.partnerName || a.name || "";
}
function partnerMatch(a,b){ return normalizeName(a)===normalizeName(b); }
function globalOrders(){ try{return JSON.parse(localStorage.getItem("agrisetu_orders_global")||"[]");}catch{return [];} }
function writeGlobalOrders(v){ localStorage.setItem("agrisetu_orders_global",JSON.stringify(v)); }
function buyerOrders(){ return globalOrders().filter(o=>o.buyerUser===state.user); }
function porterJobs(){
  const partner=normalizeName(partnerAccountName());
  const bookings=globalBookings().filter(b=>partnerMatch(b.porter,partnerAccountName()));
  const orders=globalOrders().filter(o=>partnerMatch(o.porter,o.porterName||partnerAccountName()));
  return [
    ...bookings.map(b=>({...b,jobType:"FARMER_TO_STORAGE",jobId:b.id,route:"Farmer → Cold Storage",pickupOtp:b.pickupOtp||b.otp||"",storageOtp:b.storageOtp||""})),
    ...orders.map(o=>({...o,jobType:"COLD_STORAGE_TO_BUYER",jobId:o.id,route:"Cold Storage → Buyer",pickupOtp:o.pickupOtp||"",deliveryOtp:o.deliveryOtp||""}))
  ].filter(j=>partnerMatch(j.porter,j.porterName||partner)||normalizeName(j.porter)===partner);
}
function notifyUserByEmail(email,title,message,type="info"){
  if(!email)return;
  const ns=JSON.parse(localStorage.getItem(keyForUser("notifications",email))||"[]");
  ns.unshift({id:uid("NTF"),title,message,type,createdAt:Date.now()});
  localStorage.setItem(keyForUser("notifications",email),JSON.stringify(ns.slice(0,50)));
}
function findUserEmailByNameRole(name,role){
  const wanted=normalizeName(name);
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i)||"";
    if(!k.startsWith("agrisetuAccount_"))continue;
    const email=k.slice("agrisetuAccount_".length),a=accountData(email);
    if(a.role===role && normalizeName(a.partnerName||a.name)===wanted)return email;
  }
  return "";
}

/* --- Porter-only dashboard/navigation --- */
function porterDashboard(){
  const jobs=porterJobs();
  const pending=jobs.filter(j=>!j.jobStatus||j.jobStatus==="PENDING_ACCEPTANCE"||j.status==="PENDING").length;
  const active=jobs.filter(j=>["ACCEPTED","IN_TRANSIT","STOCK_PICKED_UP","BUYER_REACHED","FARMER_REACHED"].includes(j.jobStatus||j.status)).length;
  const completed=jobs.filter(j=>["COMPLETED","DELIVERED"].includes(j.jobStatus||j.status)).length;
  return `<div class="page-head"><div class="page-icon">🚚</div><div><h1>Welcome, ${escapeHtml(partnerAccountName()||currentAccount().name||"Travel Partner")}</h1><p>Your assigned transport work only</p></div></div>
  <div class="cards">${metric("▤",String(pending),"New Jobs","orange")}${metric("♧",String(active),"Active Trips","blue")}${metric("✓",String(completed),"Completed","green")}</div>
  <div class="card section-card"><div class="section-header"><h2>Assigned Work</h2><button class="link-btn" onclick="navigate('otp')">OTP Verification</button></div>
  ${jobs.length?jobs.map(porterJobCard).join(""):emptyState("No assigned work","New transport requests will appear here when a farmer or buyer selects your travel-partner name.","profile","View Profile")}</div>`;
}
function porterJobCard(j){
  const status=j.jobStatus||j.status||"PENDING_ACCEPTANCE";
  const isFarmer=j.jobType==="FARMER_TO_STORAGE";
  const pickupLabel=isFarmer?"Farmer pickup OTP":"Cold storage pickup OTP";
  const otp=j.pickupOtp||"";
  return `<div class="card" style="margin-top:18px;border:1px solid var(--border)"><div class="section-header"><div><h2>${isFarmer?'🌾 Farmer → ❄️ Cold Storage':'❄️ Cold Storage → 🛒 Buyer'}</h2><p><b>${escapeHtml(j.product||"Produce")}</b> · ${Number(j.quantity||0).toLocaleString()} kg · Batch ${escapeHtml(j.batchId||"—")}</p></div><span class="pill ${["COMPLETED","DELIVERED"].includes(status)?'green':''}">${escapeHtml(status)}</span></div>
  <div class="form-grid" style="margin-top:18px"><div><b>${isFarmer?'Farmer':'Buyer'}</b><p class="muted">${escapeHtml(isFarmer?(j.farmerName||j.farmerUser||"Farmer"):(j.buyerName||"Buyer"))}</p></div><div><b>Pickup</b><p class="muted">${escapeHtml(j.pickupLocation||j.storage||"—")}</p></div><div><b>Destination</b><p class="muted">${escapeHtml(j.destination||j.storage||"—")}</p></div><div><b>Travel Cost</b><p class="muted">₹${Number(j.travelCost||0).toLocaleString()}</p></div></div>
  ${status==="PENDING"||status==="PENDING_ACCEPTANCE"?`<div class="risk-actions"><button class="btn btn-primary" onclick="acceptPorterJob('${escapeAttr(j.jobId)}','${escapeAttr(j.jobType)}')">Accept</button><button class="btn btn-outline" onclick="rejectPorterJob('${escapeAttr(j.jobId)}','${escapeAttr(j.jobType)}')">Reject</button></div>`:""}
  ${status!=="PENDING"&&status!=="PENDING_ACCEPTANCE"&&status!=="COMPLETED"&&status!=="DELIVERED"?`<div style="margin-top:18px"><label style="display:block;font-weight:600;margin-bottom:8px">${pickupLabel}</label><div style="display:flex;gap:10px;flex-wrap:wrap"><input id="otp-${escapeAttr(j.jobId)}" class="field-input" inputmode="numeric" maxlength="6" placeholder="Enter OTP"><button class="btn btn-primary" onclick="verifyPorterOtp('${escapeAttr(j.jobId)}','${escapeAttr(j.jobType)}')">Verify OTP</button></div><small class="muted" style="display:block;margin-top:8px">Demo OTP is shown to the farmer/buyer and must match exactly.</small></div>`:""}
  ${status==="BUYER_REACHED"?`<div class="risk-actions" style="margin-top:15px"><button class="btn btn-primary" onclick="verifyPorterOtp('${escapeAttr(j.jobId)}','BUYER_DELIVERY')">Verify Buyer Delivery OTP</button></div>`:""}</div>`;
}
function porterOtpPage(){
  const jobs=porterJobs();
  return `<div class="page-head"><div class="page-icon">✓</div><div><h1>OTP Verification</h1><p>Verify handovers for your assigned transport jobs.</p></div></div>${jobs.length?jobs.map(j=>porterJobCard(j)).join(""):emptyState("No OTP verification pending","Assigned transport jobs will appear here.","dashboard","Go to Dashboard")}`;
}
function acceptPorterJob(id,type){
  if(type==="FARMER_TO_STORAGE"){
    const all=globalBookings(),b=all.find(x=>x.id===id);if(!b)return;b.status="PORTER_ACCEPTED";b.jobStatus="ACCEPTED";b.porterAcceptedAt=Date.now();b.pickupOtp=b.pickupOtp||b.otp||String(Math.floor(100000+Math.random()*900000));b.otp=b.pickupOtp;writeGlobalBookings(all);
    notifyUserByEmail(b.farmerUser,"Travel partner accepted",`${b.porter} accepted your pickup for ${b.product}. Pickup OTP: ${b.pickupOtp}.`);
    addNotification("Job accepted",`Pickup assigned for ${b.product}.`);render();return;
  }
  const all=globalOrders(),o=all.find(x=>x.id===id);if(!o)return;o.jobStatus="ACCEPTED";o.status="PORTER_ACCEPTED";o.porterAcceptedAt=Date.now();writeGlobalOrders(all);
  notifyUserByEmail(o.buyerUser,"Travel partner accepted",`${o.porter} accepted your delivery for ${o.product}. Pickup OTP: ${o.pickupOtp}.`);
  addNotification("Delivery job accepted",`Pickup assigned for ${o.product}.`);render();
}
function rejectPorterJob(id,type){
  if(type==="FARMER_TO_STORAGE"){
    const all=globalBookings(),b=all.find(x=>x.id===id);if(!b)return;b.status="PORTER_REJECTED";b.jobStatus="REJECTED";writeGlobalBookings(all);notifyUserByEmail(b.farmerUser,"Travel partner declined",`${b.porter} declined your pickup request. Please select another travel partner.`);
  }else{const all=globalOrders(),o=all.find(x=>x.id===id);if(!o)return;o.status="PORTER_REJECTED";o.jobStatus="REJECTED";writeGlobalOrders(all);notifyUserByEmail(o.buyerUser,"Travel partner declined",`${o.porter} declined your delivery request.`);}
  addNotification("Job declined","The selected transport request was declined.","danger");render();
}
function verifyPorterOtp(id,type){
  const input=document.getElementById(`otp-${id}`)?.value.trim();
  if(type==="FARMER_TO_STORAGE"){
    const all=globalBookings(),b=all.find(x=>x.id===id);if(!b)return;if(!input||input!==String(b.pickupOtp||b.otp)){alert("Invalid OTP. Enter the OTP shown in the farmer portal.");return;}
    b.jobStatus="STOCK_PICKED_UP";b.status="IN_TRANSIT";b.pickupVerifiedAt=Date.now();writeGlobalBookings(all);notifyUserByEmail(b.farmerUser,"Pickup verified",`${b.product} has been picked up by ${b.porter} and is in transit to ${b.storage}.`);addNotification("Pickup OTP verified",`${b.product} pickup verified successfully.`);render();return;
  }
  const all=globalOrders(),o=all.find(x=>x.id===id);if(!o)return;
  if(type==="BUYER_DELIVERY"){
    if(!input||input!==String(o.deliveryOtp||"")){alert("Invalid delivery OTP. Enter the OTP shown to the buyer.");return;}
    o.status="DELIVERED";o.jobStatus="DELIVERED";o.deliveryVerifiedAt=Date.now();writeGlobalOrders(all);notifyUserByEmail(o.buyerUser,"Delivery completed",`${o.product} has been delivered successfully.`);addNotification("Delivery completed",`${o.product} was delivered successfully.`);render();return;
  }
  if(!input||input!==String(o.pickupOtp||"")){alert("Invalid OTP. Enter the pickup OTP shown to the buyer.");return;}
  o.jobStatus="STOCK_PICKED_UP";o.status="IN_TRANSIT";o.pickupVerifiedAt=Date.now();writeGlobalOrders(all);notifyUserByEmail(o.buyerUser,"Pickup verified",`${o.product} has been picked up from ${o.storage}.`);addNotification("Storage pickup verified",`${o.product} pickup from cold storage verified.`);render();
}
function markBuyerReached(id){
  const all=globalOrders(),o=all.find(x=>x.id===id);if(!o)return;o.status="BUYER_REACHED";o.jobStatus="BUYER_REACHED";o.deliveryOtp=o.deliveryOtp||String(Math.floor(100000+Math.random()*900000));writeGlobalOrders(all);notifyUserByEmail(o.buyerUser,"Travel partner has arrived",`Your produce has arrived. Delivery OTP: ${o.deliveryOtp}. Share it with the travel partner.`);addNotification("Buyer reached","Delivery OTP is ready for the buyer.");render();
}

/* --- Buyer purchase + independent travel-partner selection --- */
function listingStorageName(l){
  if(l.storage)return l.storage;
  const b=globalBookings().find(x=>x.batchId===l.batchId);
  return b?.storage||"Cold Storage";
}
function buyerStorageOptions(){
  const map=new Map(storageOptions.map(s=>[normalizeName(s.name),s]));
  globalMarketplace().forEach(l=>{
    const name=listingStorageName(l); if(name && !map.has(normalizeName(name))) map.set(normalizeName(name),{name,location:"",distance:"",available:"",price:0,cost:0});
  });
  return [...map.values()];
}
function buyerDashboard(){
  const orders=buyerOrders(), active=orders.filter(o=>!['DELIVERED','COMPLETED'].includes(o.status)).length, delivered=orders.filter(o=>['DELIVERED','COMPLETED'].includes(o.status)).length;
  return `<div class="page-head"><div class="page-icon">▦</div><div><h1>Dashboard</h1><p>Your purchases, deliveries and marketplace activity at a glance.</p></div></div>
  <div class="buyer-welcome" style="background:linear-gradient(100deg,#0788c8,#197d94);border-radius:0 0 26px 26px;padding:28px 30px;color:#fff;margin:-4px 0 28px"><div style="font-size:18px;opacity:.95">Welcome,</div><div style="font-size:34px;font-weight:800;margin-top:4px">${escapeHtml(currentAccount().name||state.user||"Buyer")}</div></div>
  <div class="cards">${metric("◇",String(orders.length),"Total Orders","blue")}${metric("🚚",String(active),"In Progress","orange")}${metric("✓",String(delivered),"Delivered","green")}${metric("🛒",String(orders.filter(o=>o.status==='CART').length),"Cart Items","purple")}</div>
  <div class="card section-card"><div class="section-header"><h2>Current Orders</h2><button class="link-btn" onclick="navigate('orders')">View all</button></div>${orders.length?orders.slice(0,3).map(o=>`<div class="product-row"><div class="product-icon">◇</div><div class="product-info"><b>${escapeHtml(o.product)} · ${escapeHtml(o.batchId)}</b><span>${Number(o.quantity).toLocaleString()} kg · ${escapeHtml(o.storage)} · ${escapeHtml(o.porter)}</span></div><span class="pill green">${escapeHtml(o.status)}</span></div>`).join(""):emptyState("No purchases yet","Explore the marketplace to buy produce from available cold storages.","market","Open Marketplace")}</div>`;
}
function buyerMarketplacePage(){
  migrateMarketplace();
  const options=buyerStorageOptions();
  const selectedId=state.buyerStorageId||options[0]?.name||"";
  const selected=options.find(s=>normalizeName(s.name)===normalizeName(selectedId))||options[0];
  if(selected)state.buyerStorageId=selected.name;
  const all=globalMarketplace().filter(l=>l.status==="Active"&&Number(l.quantity)>0);
  const filtered=selected?all.filter(l=>normalizeName(listingStorageName(l))===normalizeName(selected.name)):[];
  return `<div class="page-head"><div class="page-icon">🛒</div><div><h1>Marketplace</h1><p>Select a nearby cold storage to see the produce currently available there.</p></div></div>
  <div class="card section-card"><div class="section-header"><div><h2>Choose Cold Storage</h2><p class="muted">Available cold storages used by farmer bookings.</p></div><select class="monitor-storage-select" style="min-width:300px" onchange="selectBuyerStorage(this.value)">${options.map(s=>`<option value="${escapeAttr(s.name)}" ${selected&&normalizeName(s.name)===normalizeName(selected.name)?'selected':''}>${escapeHtml(s.name)}${s.location?` · ${escapeHtml(s.location)}`:''}${s.distance?` · ${escapeHtml(s.distance)}`:''}</option>`).join("")}</select></div></div>
  <div class="card section-card"><div class="section-header"><div><h2>${selected?escapeHtml(selected.name):"Available Produce"}</h2><p class="muted">${selected?"Products stored in this cold storage are shown below.":"Select a cold storage to continue."}</p></div></div>${filtered.length?filtered.map(l=>`<div class="product-row"><div class="product-icon">🛒</div><div class="product-info"><b>${escapeHtml(l.product)} · ${escapeHtml(l.batchId)}</b><span>${Number(l.quantity).toLocaleString()} kg · ₹${Number(l.price).toFixed(2)}/kg · Seller: ${escapeHtml(l.sellerName||l.seller||"Farmer")}</span></div><button class="btn btn-primary" onclick="openBuyerPurchase('${escapeAttr(l.id)}')">Buy Product</button></div>`).join(""):emptyState("No produce available in this cold storage yet.",selected?`You have not purchased any produce from ${selected.name}.`:"Select a cold storage to view available produce.","market","Choose Another Cold Storage")}</div>`;
}
function selectBuyerStorage(name){state.buyerStorageId=name;render();}
function registeredPorterOptions(){
  const map=new Map(porterOptions.map(p=>[normalizeName(p.name),{...p}]));
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i)||""; if(!k.startsWith("agrisetuAccount_"))continue;
    const email=k.slice("agrisetuAccount_".length),a=accountData(email); if(a.role!=="Porter")continue;
    const name=a.partnerName||a.name||""; if(!name)continue;
    const n=normalizeName(name); if(!map.has(n))map.set(n,{name,type:a.vehicleType||"Travel Partner",eta:"Demo",distance:"",price:Number(a.travelCost||650)});
  }
  return [...map.values()];
}
function resolvePorterByName(name){const wanted=normalizeName(name);return registeredPorterOptions().find(p=>normalizeName(p.name)===wanted)||null;}
function openBuyerPurchase(id){
  const l=globalMarketplace().find(x=>x.id===id);if(!l)return;
  let modal=document.getElementById("buyerPurchaseModal");if(!modal){modal=document.createElement("div");modal.className="modal-backdrop";modal.id="buyerPurchaseModal";document.body.appendChild(modal);}
  const max=Math.max(1,Number(l.quantity)||1),otp=String(Math.floor(100000+Math.random()*900000));
  modal.innerHTML=`<div class="modal" style="max-height:92vh;overflow:auto"><div class="modal-head"><h2>Buy ${escapeHtml(l.product)}</h2><button class="close" onclick="document.getElementById('buyerPurchaseModal')?.remove()">×</button></div><p>Available: <b>${max.toLocaleString()} kg</b> · ₹${Number(l.price).toFixed(2)}/kg</p><div class="field"><label>Quantity (kg)</label><input id="buyerQty" type="number" min="1" max="${max}" value="${Math.min(100,max)}"></div><div class="field" style="margin-top:18px"><label>Travel Partner Name</label><input id="buyerPorterName" list="buyerPorterNames" placeholder="Enter the exact travel partner name" autocomplete="off"><datalist id="buyerPorterNames">${registeredPorterOptions().map(p=>`<option value="${escapeAttr(p.name)}"></option>`).join("")}</datalist><small style="display:block;margin-top:8px;color:var(--muted)">Enter the same travel partner name that is registered for the booking.</small></div><div class="form-grid" style="margin-top:18px"><div class="field"><label>Payment for Produce / Cold Storage</label><select id="buyerProductPayment"><option>UPI</option><option>Card</option><option>Net Banking</option></select></div><div class="field"><label>Payment for Travel Partner</label><select id="buyerPorterPayment"><option>UPI</option><option>Card</option><option>Net Banking</option></select></div></div><div class="otp-box" style="margin-top:20px"><div class="otp-label">Demo Pickup OTP</div><div class="otp" id="buyerDemoOtp">${otp}</div><p>Keep this OTP. The selected travel partner must enter the same OTP at cold-storage pickup.</p></div><div class="actions" style="margin-top:25px"><button class="btn btn-outline" onclick="document.getElementById('buyerPurchaseModal')?.remove()">Cancel</button><button class="btn btn-primary" onclick="completeBuyerPurchase('${escapeAttr(id)}')">Proceed to Payment</button></div></div>`;
}
function completeBuyerPurchase(listingId){
  const all=globalMarketplace(),l=all.find(x=>x.id===listingId);if(!l)return;
  const qty=Number(document.getElementById("buyerQty")?.value||0),porterName=document.getElementById("buyerPorterName")?.value.trim()||"",productPayment=document.getElementById("buyerProductPayment")?.value||"UPI",porterPayment=document.getElementById("buyerPorterPayment")?.value||"UPI";
  const p=resolvePorterByName(porterName);
  if(!p){alert("Enter a registered travel partner name exactly as shown in the farmer or buyer booking.");return;}
  if(!qty||qty<=0||qty>Number(l.quantity)){alert(`Only ${Number(l.quantity).toLocaleString()} kg is currently available.`);return;}
  const otp=document.getElementById("buyerDemoOtp")?.textContent.trim()||String(Math.floor(100000+Math.random()*900000));
  l.quantity=Number(l.quantity)-qty;if(l.quantity<=0){l.quantity=0;l.status="SOLD OUT";}
  const a=currentAccount(),productTotal=Number(l.price)*qty,transportTotal=Number(p.price||0),invoiceNumber=`INV-${Date.now().toString().slice(-10)}`;
  const order={id:uid("ORD"),buyerUser:state.user,buyerName:a.name||state.user,farmerUser:l.seller,farmerName:l.sellerName||l.seller,product:l.product,batchId:l.batchId,storage:listingStorageName(l),storageId:l.storageId||"",quantity:qty,price:Number(l.price),total:productTotal+transportTotal,productTotal,transportTotal,porter:p.name,porterName:p.name,porterType:p.type,travelCost:transportTotal,productPaymentMethod:productPayment,porterPaymentMethod:porterPayment,pickupOtp:otp,status:"PORTER_PENDING",jobStatus:"PENDING_ACCEPTANCE",invoiceNumber,invoiceStatus:"Paid",createdAt:Date.now(),pickupLocation:listingStorageName(l),destination:a.location||"Buyer",deliveryOtp:""};
  all[all.indexOf(l)]=l;writeGlobalMarketplace(all);
  const orders=globalOrders();orders.unshift(order);writeGlobalOrders(orders);
  const payments=readStore("payments",[]);payments.unshift({id:uid("PAY"),type:"buyer_product_payment",product:l.product,quantity:qty,batchId:l.batchId,amount:productTotal,method:productPayment,payee:l.sellerName||l.seller,createdAt:Date.now(),invoiceNumber});payments.unshift({id:uid("PAY"),type:"buyer_transport_payment",product:l.product,quantity:qty,batchId:l.batchId,amount:transportTotal,method:porterPayment,payee:p.name,createdAt:Date.now(),invoiceNumber});writeStore("payments",payments);
  notifyUserByEmail(l.seller,"Product purchased",`${a.name||state.user} purchased ${qty.toLocaleString()} kg of ${l.product}.`);
  notifyUserByEmail(findUserEmailByNameRole(p.name,"Porter"),"New delivery assignment",`Buyer ${a.name||state.user} selected you for ${qty.toLocaleString()} kg of ${l.product}. Pickup OTP: ${otp}.`);
  addNotification("Purchase successful",`${qty.toLocaleString()} kg of ${l.product} purchased. ${p.name} is the selected travel partner.`);
  document.getElementById("buyerPurchaseModal")?.remove();render();
}
function buyerInvoicesPage(){
  const orders=buyerOrders();
  return `<div class="page-head"><div class="page-icon">▤</div><div><h1>Invoices</h1><p>Download your buyer invoices in the standard Agrisetu invoice format.</p></div></div><div class="invoices">${orders.length?orders.map(o=>`<div class="card invoice-card"><span class="paid">Paid</span><div class="product-icon">▤</div><div class="invoice-number">${escapeHtml(o.invoiceNumber||`INV-${o.id.slice(-9)}`)}</div><div style="margin-top:10px">${escapeHtml(o.product)} · ${Number(o.quantity).toLocaleString()} kg<br><span style="color:var(--muted)">${escapeHtml(o.storage)} · ${new Date(o.createdAt).toLocaleDateString()}</span></div><hr><div class="invoice-bottom"><b>₹${Number(o.total).toLocaleString()}</b><button class="btn btn-outline" onclick="printBuyerInvoice('${escapeAttr(o.id)}')">⇩　Download Invoice</button></div></div>`).join(""):emptyState("No invoices yet","A buyer invoice will be generated after a successful purchase.","market","Open Marketplace")}</div>`;
}
function printBuyerInvoice(orderId){
  const o=globalOrders().find(x=>x.id===orderId&&x.buyerUser===state.user);if(!o)return;
  const win=window.open("","_blank","width=900,height=1000");if(!win){alert("Please allow pop-ups to print the invoice as PDF.");return;}
  const date=new Date(o.createdAt).toISOString().slice(0,10);
  win.document.write(`<!doctype html><html><head><title>${escapeHtml(o.invoiceNumber||"Invoice")}</title><style>@page{size:A4;margin:0}body{margin:0;font-family:Arial,sans-serif;color:#101820;background:#fff}.invoice{width:794px;min-height:1123px;margin:0 auto;border:1px solid #ddd;box-sizing:border-box}.header{height:158px;background:#218c57;color:#fff;padding:40px 52px;box-sizing:border-box;display:flex;justify-content:space-between}.brand{font-size:34px;font-weight:700}.sub{font-size:18px;margin-top:8px}.inv{font-size:34px;font-weight:700}.body{padding:43px 52px}.meta{font-size:17px;line-height:1.6;margin-bottom:55px}.date{float:right;margin-top:-27px}.table-head,.row{display:grid;grid-template-columns:1fr 150px;padding:15px 22px;font-size:17px}.table-head{background:#f2f2f2;font-weight:700}.row{padding-top:15px;padding-bottom:15px}.total{border-top:1px solid #ccc;margin-top:12px;padding:17px 22px;display:flex;justify-content:space-between;font-size:28px;font-weight:700}.paidline{padding:0 22px;font-size:17px}.footer{margin-top:45px;font-size:16px;color:#66727a}.amount{text-align:right}.small{color:#66727a;font-size:15px;margin-top:5px}</style></head><body><div class="invoice"><div class="header"><div><div class="brand">Agrisetu</div><div class="sub">Smart Cold Storage &amp; Agri Logistics</div></div><div class="inv">INVOICE</div></div><div class="body"><div class="meta"><div>Invoice No: ${escapeHtml(o.invoiceNumber||"")}</div><div>Billed To: ${escapeHtml(o.buyerName||state.user)}</div><div>Counterparty: ${escapeHtml(o.farmerName||"Farmer")}</div><div>Cold Storage: ${escapeHtml(o.storage)}</div><div>Travel Partner: ${escapeHtml(o.porter)}</div><div>Product: ${escapeHtml(o.product)} (${Number(o.quantity).toLocaleString()} kg)</div><div class="date">Date: ${date}</div></div><div class="table-head"><div>Description</div><div class="amount">Amount</div></div><div class="row"><div>Produce Charges</div><div class="amount">Rs. ${Number(o.productTotal||0).toLocaleString()}</div></div><div class="row"><div>Transportation Charges</div><div class="amount">Rs. ${Number(o.transportTotal||0).toLocaleString()}</div></div><div class="total"><div>Total Amount</div><div>Rs. ${Number(o.total||0).toLocaleString()}</div></div><div class="paidline">Payment Status: Paid</div><div class="footer">This is a system-generated invoice from Agrisetu.<br>Thank you for using Agrisetu.</div></div></div><script>window.onload=()=>{window.focus();window.print();}</script></body></html>`);win.document.close();
}

function buyerOrdersPage(){
  const orders=buyerOrders();
  return `<div class="page-head"><div class="page-icon">▤</div><div><h1>My Purchases</h1><p>View only your purchases and delivery OTPs.</p></div></div>${orders.length?orders.map(o=>`<div class="card" style="margin-bottom:18px"><div class="section-header"><div><h2>${escapeHtml(o.product)} · ${escapeHtml(o.batchId)}</h2><p>${Number(o.quantity).toLocaleString()} kg · ${escapeHtml(o.storage)} · Travel partner: <b>${escapeHtml(o.porter)}</b></p></div><span class="pill green">${escapeHtml(o.status)}</span></div><div class="sensor-grid"><div><span>Purchase Total</span><b>₹${Number(o.total).toLocaleString()}</b></div><div><span>Pickup OTP</span><b>${escapeHtml(o.pickupOtp||"—")}</b></div><div><span>Delivery OTP</span><b>${escapeHtml(o.deliveryOtp||"Generated on arrival")}</b></div><div><span>Quantity</span><b>${Number(o.quantity).toLocaleString()} kg</b></div></div></div>`).join(""):emptyState("No purchases yet","Buy produce from the marketplace to create a delivery booking.","market","Open Marketplace")}`;
}

/* --- Registration/login: Porter name is required for matching --- */
function registerPage(){
  const porterExtra=state.role==="Porter"?`<div class="field" style="margin-top:18px"><label>Travel Partner Name</label><input id="registerPartnerName" type="text" placeholder="Enter your travel partner name"><small style="display:block;margin-top:8px;color:var(--muted)">Enter the exact name that farmers or buyers will use when assigning you a booking.</small></div>`:"";
  const storageExtra=state.role==="Cold Storage"?`<div class="field" style="margin-top:18px"><label>Cold Storage Name</label><select id="registerStorageName"><option value="">Select your cold storage</option>${storageOptions.map(s=>`<option value="${escapeAttr(s.name)}">${escapeHtml(s.name)}</option>`).join("")}</select><small style="display:block;margin-top:8px;color:var(--muted)">Select the same storage name that farmers use when booking.</small></div>`:"";
  return `<div class="login-wrap"><div class="login-card"><div class="login-logo"><img src="assets/logo.png"><h1>Agrisetu</h1><p>Bridging Farmers to a Fresher Tomorrow</p></div><div id="registerError"></div><div style="margin-top:25px"><div class="field"><label>Full Name</label><input id="registerName" type="text" placeholder="Enter your name"></div><div class="field" style="margin-top:18px"><label>Phone Number</label><input id="registerPhone" type="tel" placeholder="Enter your phone number"></div><div class="field" style="margin-top:18px"><label>Email</label><input id="registerEmail" type="email" placeholder="Enter your email"></div><div class="field" style="margin-top:18px"><label>Password</label><input id="registerPassword" type="password" placeholder="Create a password"></div><div class="field" style="margin-top:18px"><label>Confirm Password</label><input id="registerConfirm" type="password" placeholder="Confirm your password"></div><div style="margin:22px 0 10px;font-weight:600">Register as</div><div class="role-grid">${["Farmer","Cold Storage","Porter","Buyer"].map(r=>`<button class="role ${state.role===r?"selected":""}" onclick="selectRegisterRole('${r}')">◯ &nbsp;${r}</button>`).join("")}</div>${porterExtra}${storageExtra}<button class="btn btn-primary login-submit" onclick="doRegister()">Create account</button><button class="btn btn-outline login-submit" onclick="showLogin()">← Back to login</button></div></div></div>`;
}
function doRegister(){
  const name=document.getElementById("registerName")?.value.trim(),phone=document.getElementById("registerPhone")?.value.trim(),email=document.getElementById("registerEmail")?.value.trim().toLowerCase(),password=document.getElementById("registerPassword")?.value,confirm=document.getElementById("registerConfirm")?.value,err=document.getElementById("registerError");
  const storageName=state.role==="Cold Storage"?(document.getElementById("registerStorageName")?.value||"").trim():"";
  const partnerName=state.role==="Porter"?(document.getElementById("registerPartnerName")?.value||"").trim():"";
  if(!name||!phone||!email||!password||!confirm||(state.role==="Cold Storage"&&!storageName)||(state.role==="Porter"&&!partnerName)){err.innerHTML='<div class="error">Please fill in all required fields.</div>';return;}
  if(password!==confirm){err.innerHTML='<div class="error">Passwords do not match.</div>';return;}
  if(password.length<6){err.innerHTML='<div class="error">Password must be at least 6 characters.</div>';return;}
  if(localStorage.getItem(`agrisetuPassword_${email}`)){err.innerHTML='<div class="error">An account with this email already exists. Please log in.</div>';return;}
  localStorage.setItem(`agrisetuPassword_${email}`,password);
  localStorage.setItem(`agrisetuAccount_${email}`,JSON.stringify({name,phone,email,role:state.role,storageName:storageName||undefined,partnerName:partnerName||undefined,location:""}));
  localStorage.setItem(`agrisetuRole_${email}`,state.role);localStorage.setItem("agrisetuUser",email);state.user=email;state.loggedIn=true;state.page="dashboard";seedUserData();addNotification("Account created",`Welcome to Agrisetu, ${name}.`);render();
}
function login(){
  const porterExtra=state.role==="Porter"?`<div class="field" style="margin-top:18px"><label>Travel Partner Name</label><input id="loginPartnerName" type="text" placeholder="Enter your registered travel partner name"><small style="display:block;margin-top:8px;color:var(--muted)">The name must exactly match the name registered for this account.</small></div>`:"";
  return `<div class="login-wrap"><div class="login-card"><div class="login-logo"><img src="assets/logo.png"><h1>Agrisetu</h1><p>Bridging Farmers to a Fresher Tomorrow</p></div>${state.user?`<div style="background:#eef9f2;padding:12px;border-radius:10px;color:#176e3d">Returning user: <b>${escapeHtml(state.user)}</b></div>`:""}<div id="loginError"></div><div style="margin-top:25px"><div class="field"><label>Email</label><input id="email" type="email" placeholder="Enter your email" value="${escapeAttr(state.user)}"></div><div class="field" style="margin-top:18px"><label>Password</label><input id="password" type="password" placeholder="Enter your password"></div><div style="margin:22px 0 10px;font-weight:600">Login as</div><div class="role-grid">${["Farmer","Cold Storage","Porter","Buyer"].map(r=>`<button class="role ${state.role===r?"selected":""}" onclick="selectRole('${r}')">◯ &nbsp;${r}</button>`).join("")}</div>${porterExtra}<button class="btn btn-primary login-submit" onclick="doLogin()">Log in</button><button class="btn btn-outline login-submit" onclick="state.page='landing';render()">← Back to landing page</button><div class="register-prompt">Don't have an account? <button type="button" onclick="showRegister()">Create one</button></div></div></div></div>`;
}
function doLogin(){
  const email=document.getElementById("email")?.value.trim().toLowerCase(),password=document.getElementById("password")?.value,err=document.getElementById("loginError");
  if(!email||!password){err.innerHTML='<div class="error">Please enter your email and password.</div>';return;}
  const existing=localStorage.getItem(`agrisetuPassword_${email}`);if(existing&&existing!==password){err.innerHTML='<div class="error">Invalid email or password.</div>';return;}
  const accountRaw=localStorage.getItem(`agrisetuAccount_${email}`);if(accountRaw){try{const account=JSON.parse(accountRaw);state.role=account.role||state.role;if(state.role==="Porter"){const partner=document.getElementById("loginPartnerName")?.value.trim();if(!partner||!partnerMatch(partner,account.partnerName||account.name)){err.innerHTML='<div class="error">Travel partner name does not match this account.</div>';return;}}}catch{}}
  localStorage.setItem(`agrisetuPassword_${email}`,password);localStorage.setItem("agrisetuUser",email);sessionStorage.setItem("agrisetuSession","true");state.user=email;state.loggedIn=true;state.page="dashboard";seedUserData();render();
}

/* --- Shell: only add the requested Porter and Buyer pages; keep other portals unchanged. --- */
function shell(content){
  const isCold=state.role==="Cold Storage",isPorter=state.role==="Porter",isBuyer=state.role==="Buyer";
  const items=isCold
    ? [["dashboard","▦","Dashboard"],["requests","▱","Booking Requests"],["incoming","◇","Incoming Stock"],["stored","▤","Stored Stock"],["price","◇","Price Listing"],["monitor","♧","Monitoring"],["notifications","♧","Notifications"],["profile","♙","Profile"]]
    : isPorter
    ? [["dashboard","▦","Dashboard"],["assigned","▤","Assigned Work"],["otp","✓","OTP Verification"],["active","♧","Active Trips"],["notifications","♧","Notifications"],["profile","♙","Profile"]]
    : isBuyer
    ? [["dashboard","▦","Dashboard"],["market","▣","Marketplace"],["orders","▤","My Purchases"],["invoices","▤","Invoices"],["notifications","♧","Notifications"],["profile","♙","Profile"]]
    : [["dashboard","▦","Dashboard"],["book","▤","Book Storage"],["storage","♧","My Storage"],["products","◇","My Products"],["market","▣","Marketplace"],["monitor","♧","Monitoring"],["alerts","⚠","Spoilage Alerts"],["discounts","◇","Discounts"],["payments","▭","Payments"],["invoices","▤","Invoices"],["notifications","♧","Notifications"],["profile","♙","Profile"]];
  const displayName=currentAccount().name||state.user||"User",portalLabel=isCold?"Cold Storage":isPorter?"Porter":isBuyer?"Buyer":"Farmer";
  return `<div class="app-shell"><div class="sidebar-overlay" id="sidebarOverlay" onclick="toggleSidebar()"></div><aside class="sidebar" id="sidebar"><div class="side-brand"><img src="assets/logo.png"><div><div class="title">Agrisetu</div><div class="sub">${escapeHtml(isCold?(coldStorageName()||"Cold Storage"):isPorter?(partnerAccountName()||"Travel Partner"):portalLabel)} Portal</div></div><button class="close-side" onclick="toggleSidebar()">×</button></div><div class="menu">${items.map(([pg,i,l])=>`<button class="menu-item ${state.page===pg?'active':''}" onclick="navigate('${pg}')"><span class="menu-icon">${i}</span>${t(l)}${pg==='notifications'&&readStore('notifications',[]).length?`<span class="menu-count">${Math.min(readStore('notifications',[]).length,99)}</span>`:""}</button>`).join("")}</div><button class="back-landing" onclick="logout()">◎ &nbsp; Back to landing page</button></aside><main class="main"><header class="app-top"><button class="hamb" onclick="toggleSidebar()">☰</button><div><div class="top-title">${t(pageTitle())}</div><div class="top-sub">${t(portalLabel)} · ${t("ColdChain Network")}</div></div><div class="spacer"></div><div class="top-actions"><div class="language-wrap"><button class="language-btn" onclick="toggleLanguageMenu(event)" aria-label="Select language"><span>◎</span> <span id="current-language">${getLanguageLabel()}</span><span class="language-chevron">⌄</span></button><div id="language-menu" class="language-menu" onclick="event.stopPropagation()"><button onclick="selectLanguage('English','EN')">English</button><button onclick="selectLanguage('Hindi','हिन्दी')">हिन्दी</button><button onclick="selectLanguage('Marathi','मराठी')">मराठी</button><button onclick="selectLanguage('Telugu','తెలుగు')">తెలుగు</button><button onclick="selectLanguage('Punjabi','ਪੰਜਾਬੀ')">ਪੰਜਾਬੀ</button></div></div><span>♙ ${escapeHtml(portalLabel)}</span><button class="top-notif" onclick="navigate('notifications')"><span class="notif">♧<i class="notif-badge">0</i></span></button><span class="avatar">${escapeHtml((displayName||"U").slice(0,2).toUpperCase())}</span></div></header><div class="content">${content}</div></main></div>`;
}
function pageTitle(){return ({dashboard:"Dashboard",book:"Book Storage",storage:"My Storage",products:"My Products",market:"Marketplace",monitor:"Monitoring",alerts:"Spoilage Alerts",discounts:"Discounts",payments:"Payments",invoices:"Invoices",notifications:"Notifications",requests:"Booking Requests",incoming:"Incoming Stock",stored:"Stored Stock",price:"Price Listing",profile:"Profile",assigned:"Assigned Work",otp:"OTP Verification",active:"Active Trips",orders:"My Purchases"})[state.page]||"Dashboard";}
function genericPage(){
  if(state.role==="Porter"){
    if(state.page==="assigned"||state.page==="dashboard")return porterDashboard();
    if(state.page==="otp")return porterOtpPage();
    if(state.page==="active")return porterDashboard();
    if(state.page==="profile")return profilePage();
    if(state.page==="notifications")return notificationsPage();
  }
  if(state.role==="Buyer"){
    if(state.page==="dashboard")return buyerDashboard();
    if(state.page==="market")return buyerMarketplacePage();
    if(state.page==="orders")return buyerOrdersPage();
    if(state.page==="invoices")return buyerInvoicesPage();
    if(state.page==="profile")return profilePage();
    if(state.page==="notifications")return notificationsPage();
  }
  if(state.role==="Cold Storage"){if(state.page==="requests")return bookingRequestsPage();if(state.page==="incoming")return coldStockPage("incoming");if(state.page==="stored")return coldStockPage("stored");if(state.page==="price")return coldPricePage();if(state.page==="profile")return profilePage();if(state.page==="dashboard")return coldStorageDashboard();if(state.page==="monitor")return coldMonitorPage();}
  if(state.page==="profile")return profilePage();
  if(state.page==="storage")return storagePage();
  if(state.page==="monitor")return monitoringPage();
  if(state.page==="products")return productsPage();
  if(state.page==="market")return marketplacePage();
  if(state.page==="alerts")return alertsPage();
  if(state.page==="discounts")return discountsPage();
  if(state.page==="payments")return paymentsPage();
  if(state.page==="notifications")return notificationsPage();
  return `<div class="page-head"><div class="page-icon">▤</div><div><h1>${t(pageTitle())}</h1><p>${t("Your portal section is ready.")}</p></div></div>`;
}

/* Extend farmer booking record with the demo pickup OTP without changing its UI. */
function finishBooking(total){
  const s=storageOptions[state.selectedStorage??2],p=porterOptions[state.selectedPorter??0],product=state.bookingProduct||"Potato",quantity=state.bookingQuantity||1000,batchId=state.batchId||`${product.slice(0,3).toUpperCase()}-${Math.floor(1000+Math.random()*9000)}`;
  const otp=state.otp||String(Math.floor(100000+Math.random()*900000));
  const booking={id:uid("BKG"),product,quantity,batchId,storage:s.name,storageId:`${s.name.replace(/\s+/g,"-").toLowerCase()}`,porter:p.name,porterName:p.name,porterType:p.type,step:1,status:"PENDING",jobStatus:"PENDING_ACCEPTANCE",storageAccepted:false,farmerUser:state.user,farmerName:currentAccount().name||state.user,pickupDate:state.bookingDate||"TBD",pickupLocation:state.bookingLocation||"Agra",destination:s.name,pickupOtp:otp,otp,travelCost:p.price,createdAt:Date.now()};
  const bookings=readStore("bookings",[]);bookings.unshift(booking);writeStore("bookings",bookings);const global=globalBookings();global.unshift({...booking});writeGlobalBookings(global);notifyMatchingColdStorages(booking);
  const products=readStore("products",[]),existing=products.find(x=>x.batchId===batchId);if(existing){existing.storage=s.name;existing.storageId=booking.storageId;existing.storageAccepted=false;existing.bookingId=booking.id;}else products.unshift({id:uid("PRD"),product,quantity,location:state.bookingLocation||"Agra",batchId,storage:s.name,storageId:booking.storageId,storageAccepted:false,bookingId:booking.id,createdAt:Date.now()});writeStore("products",products);
  const payments=readStore("payments",[]);payments.unshift({id:uid("PAY"),type:"Storage",product,quantity,batchId,amount:s.cost,method:state.paymentMethod,payee:s.name,createdAt:Date.now()});payments.unshift({id:uid("PAY"),type:"Transportation",product,quantity,batchId,amount:p.price,method:state.paymentMethod,payee:p.name,createdAt:Date.now()});writeStore("payments",payments);
  const porterEmail=findUserEmailByNameRole(p.name,"Porter");notifyUserByEmail(porterEmail,"New pickup assignment",`You have a new farmer pickup for ${product}. Pickup OTP: ${otp}.`);
  addNotification("New booking",`${state.user} booked ${Number(quantity).toLocaleString()} kg of ${product} at ${s.name}.`);addNotification("✓ Payment completed",`Payment successful. Invoice generated. Awaiting ${s.name} acceptance.`);closePayment();state.paymentDone=true;state.bookingStep=1;state.selectedStorage=null;state.selectedPorter=null;state.otp="";state.page="storage";render();
}

/* Keep the farmer's selected partner name in the profile editable. */
function profilePage(){
  const a=currentAccount();
  return `<div class="page-head"><div class="page-icon">♙</div><div><h1>Profile</h1><p>Your profile and account details.</p></div></div><div class="card profile-card"><div class="profile-header"><div class="profile-avatar">${escapeHtml((a.name||state.user||"U").slice(0,2).toUpperCase())}</div><div><h2>${escapeHtml(a.name||state.user||"User")}</h2><p>${escapeHtml(state.role)}</p></div></div><div class="form-grid" style="margin-top:25px"><div class="field"><label>Full Name</label><input id="profileName" value="${escapeAttr(a.name||"")}"></div><div class="field"><label>Phone Number</label><input id="profilePhone" value="${escapeAttr(a.phone||"")}"></div><div class="field"><label>Email</label><input id="profileEmail" value="${escapeAttr(a.email||state.user)}" disabled></div>${state.role==="Cold Storage"?`<div class="field"><label>Storage Name</label><input id="profileStorageName" value="${escapeAttr(a.storageName||a.name||"")}"></div>`:""}${state.role==="Porter"?`<div class="field"><label>Travel Partner Name</label><input id="profilePartnerName" value="${escapeAttr(a.partnerName||a.name||"")}" placeholder="Enter your travel partner name"></div>`:""}</div><button class="btn btn-primary" style="margin-top:22px" onclick="saveProfile()">Save Changes</button></div>`;
}
function saveProfile(){
  const a=currentAccount();a.name=document.getElementById("profileName")?.value.trim()||a.name;a.phone=document.getElementById("profilePhone")?.value.trim()||a.phone;if(state.role==="Cold Storage")a.storageName=document.getElementById("profileStorageName")?.value.trim()||a.storageName||a.name;if(state.role==="Porter")a.partnerName=document.getElementById("profilePartnerName")?.value.trim()||a.partnerName||a.name;localStorage.setItem(`agrisetuAccount_${state.user}`,JSON.stringify(a));localStorage.setItem(`agrisetuRole_${state.user}`,state.role);addNotification("Profile updated","Your profile changes have been saved.","info");render();
}

/* Allow a porter to advance an accepted job to the next handover from Active Trips. */
function porterActivePage(){
  const jobs=porterJobs().filter(j=>["ACCEPTED","IN_TRANSIT","STOCK_PICKED_UP","BUYER_REACHED"].includes(j.jobStatus||j.status));
  return `<div class="page-head"><div class="page-icon">♧</div><div><h1>Active Trips</h1><p>Only trips assigned to ${escapeHtml(partnerAccountName())} are shown.</p></div></div>${jobs.length?jobs.map(j=>`<div class="card" style="margin-bottom:18px"><div class="section-header"><div><h2>${escapeHtml(j.route)}</h2><p>${escapeHtml(j.product)} · ${Number(j.quantity||0).toLocaleString()} kg</p></div><span class="pill green">${escapeHtml(j.jobStatus||j.status)}</span></div>${(j.jobStatus||j.status)==="STOCK_PICKED_UP"?`<button class="btn btn-primary" onclick="${j.jobType==='COLD_STORAGE_TO_BUYER'?`markBuyerReached('${escapeAttr(j.jobId)}')`:`markFarmerStorageReached('${escapeAttr(j.jobId)}')`}">${j.jobType==='COLD_STORAGE_TO_BUYER'?'Mark Buyer Reached':'Mark Storage Reached'}</button>`:""}${(j.jobStatus||j.status)==="IN_TRANSIT"&&j.jobType==='COLD_STORAGE_TO_BUYER'?`<button class="btn btn-primary" onclick="markBuyerReached('${escapeAttr(j.jobId)}')">Mark Buyer Reached</button>`:""}</div>`).join(""):emptyState("No active trips","Accepted transport jobs will appear here.","assigned","View Assigned Work")}`;
}
function markFarmerStorageReached(id){
  const all=globalBookings(),b=all.find(x=>x.id===id);if(!b)return;b.jobStatus="STORAGE_REACHED";b.status="STORAGE_REACHED";writeGlobalBookings(all);notifyUserByEmail(b.farmerUser,"Stock reached cold storage",`${b.product} has reached ${b.storage}. The cold-storage handler can now receive it.`);addNotification("Storage reached",`${b.product} reached ${b.storage}.`);render();
}

/* Replace the renderer once, so the appended role pages are used. */
function render(){
  if(liveMonitoringTimer){clearInterval(liveMonitoringTimer);liveMonitoringTimer=null;}seedUserData();
  if(!state.loggedIn){app.innerHTML=state.page==="login"?login():state.page==="register"?registerPage():landing();return;}
  let content=state.page==="dashboard"&&state.role!=="Cold Storage"&&state.role!=="Porter"&&state.role!=="Buyer"?dashboard():state.page==="book"?book():state.page==="invoices"?invoices():genericPage();
  app.innerHTML=shell(content);applyLanguage();renderNotificationBadge();
  if(state.page==="monitor"||state.page==="storage"||state.page==="dashboard"){refreshLiveMonitoring();liveMonitoringTimer=setInterval(refreshLiveMonitoring,3000);}
}

render();
