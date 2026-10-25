<script>
(function(){
  // ---- Settings you can edit ----
  const PREFIXES = ['ZS1-', 'SP1-'];       // must match what your designer outputs
  const SHIPPING = 4.99;
  const SALE_MIN_QTY = 3;                  // "buy 3, cut total price in half"
  const SALE_FACTOR  = 0.5;
  const PRINT_AREA = {                     // keep identical to your designer
    front:{x:165,y:190,w:170,h:250},
    back: {x:165,y:190,w:170,h:250}
  };
  const COLOR_NAMES = {'#FFFFFF':'White','#1A1A1A':'Black','#C1440E':'Rust','#2E4A6B':'Denim Blue','#6B7A4F':'Olive','#D8D2C2':'Chalk','#7B2D3E':'Wine','#E8C547':'Mustard'};

  const $ = id => document.getElementById(id);
  const money = n => '$' + n.toFixed(2);
  const canvas = $('shirtCanvas'), ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  let decoded = null, view = 'front';

  // ---- Decoding ----
  function b64ToUtf8(b64){
    const bin = atob(b64);
    let s = '';
    for(let i=0;i<bin.length;i++) s += '%' + ('00'+bin.charCodeAt(i).toString(16)).slice(-2);
    return decodeURIComponent(s);
  }
  function parseCode(raw){
    raw = raw.replace(/\s+/g,'');
    const prefix = PREFIXES.find(p => raw.startsWith(p));
    if(!prefix) return {error:'That doesn\'t look like a ZenShirts order code. It should start with "' + PREFIXES[0] + '". Try copying it again from the designer.'};
    try{
      const data = JSON.parse(b64ToUtf8(raw.slice(prefix.length)));
      if(!data || !data.L) return {error:'This code is missing its design. Please re-copy the whole thing.'};
      return {data};
    }catch(e){
      return {error:'We couldn\'t read that code. It may have been cut off when copying. Please try again.'};
    }
  }
  function loadImages(data){
    const jobs = [];
    ['front','back'].forEach(v => (data.L[v]||[]).forEach(l => {
      if(l.t === 'i' && l.d) jobs.push(new Promise(res => {
        const im = new Image();
        im.onload = () => { l._img = im; res(); };
        im.onerror = () => res();
        im.src = l.d;
      }));
    }));
    return Promise.all(jobs);
  }

  // ---- Drawing (same look as the designer) ----
  // If your designer's shirtPath differs, paste yours over this one.
  function shirtPath(c){
    c.beginPath();
    c.moveTo(166,55); c.lineTo(116,58); c.lineTo(16,112); c.lineTo(56,205); c.lineTo(118,160);
    c.lineTo(118,580); c.quadraticCurveTo(130,600,156,600);
    c.lineTo(344,600); c.quadraticCurveTo(370,600,384,580);
    c.lineTo(384,160); c.lineTo(444,205); c.lineTo(484,112); c.lineTo(384,58); c.lineTo(334,55);
    c.quadraticCurveTo(320,92,250,92); c.quadraticCurveTo(180,92,166,55);
    c.closePath();
  }
  function drawShirt(color, v){
    ctx.save(); shirtPath(ctx);
    ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.stroke();
    ctx.restore();
    ctx.save(); shirtPath(ctx); ctx.clip();
    const g = ctx.createLinearGradient(0,0,W,H);
    g.addColorStop(0,'rgba(0,0,0,0.06)'); g.addColorStop(0.5,'rgba(255,255,255,0.05)'); g.addColorStop(1,'rgba(0,0,0,0.08)');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    ctx.beginPath(); ctx.moveTo(178,58); ctx.quadraticCurveTo(250,100,322,58);
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.stroke();
    if(v === 'back'){
      ctx.beginPath(); ctx.moveTo(250,92); ctx.lineTo(250,595);
      ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
  }
  function drawLayer(l){
    ctx.save();
    ctx.translate(l.x + l.w/2, l.y + l.h/2);
    ctx.rotate((l.r||0) * Math.PI/180);
    if(l.t === 'x'){
      ctx.font = (l.i?'italic ':'') + (l.b?'700 ':'400 ') + l.sz + 'px ' + l.f;
      ctx.fillStyle = l.c; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(l.s), 0, 0);
    }else if(l.t === 'i' && l._img){
      ctx.drawImage(l._img, -l.w/2, -l.h/2, l.w, l.h);
    }
    ctx.restore();
  }
  function renderView(v){
    view = v;
    $('osFront').classList.toggle('active', v === 'front');
    $('osBack').classList.toggle('active', v === 'back');
    ctx.clearRect(0,0,W,H);
    drawShirt(decoded.col, v);
    const pa = PRINT_AREA[v];
    ctx.save(); ctx.beginPath(); ctx.rect(pa.x,pa.y,pa.w,pa.h); ctx.clip();
    (decoded.L[v]||[]).forEach(drawLayer);
    ctx.restore();
  }
  $('osFront').addEventListener('click', () => decoded && renderView('front'));
  $('osBack').addEventListener('click',  () => decoded && renderView('back'));
  if(document.fonts) document.fonts.ready.then(() => decoded && renderView(view));

  // ---- Summary + pricing ----
  function showCodeError(msg){
    $('codeError').textContent = msg;
    $('codeError').hidden = !msg;
  }
  function showSummary(){
    const qty = Math.max(1, parseInt(decoded.q,10) || 1);
    const sub = parseFloat(String(decoded.tot).replace(/[^0-9.]/g,'')) || 0;
    const saleOn = qty >= SALE_MIN_QTY;
    const discount = saleOn ? sub * (1 - SALE_FACTOR) : 0;
    const total = sub - discount + SHIPPING;
    decoded._total = total; decoded._qty = qty;

    $('osColor').textContent = COLOR_NAMES[String(decoded.col).toUpperCase()] || decoded.col;
    $('osSize').textContent = decoded.sz || '—';
    $('osQty').textContent = qty;
    const notes = (decoded.desc || '').trim();
    $('osNotes').textContent = notes;           // textContent: never rendered as HTML
    $('osNotesRow').hidden = !notes;
    $('osSub').textContent = money(sub);
    $('osSaleRow').hidden = !saleOn;
    $('osSale').textContent = '-' + money(discount);
    $('osShip').textContent = money(SHIPPING);
    $('osTotal').textContent = money(total);

    $('osBack').style.display = (decoded.L.back||[]).length ? '' : 'none';
    $('orderSummary').hidden = false;
    renderView('front');
  }
  function tryDecode(showErrors){
    const raw = $('ordercode').value.trim();
    decoded = null; $('orderSummary').hidden = true;
    if(!raw){ showCodeError(''); return; }
    const r = parseCode(raw);
    if(r.error){ showCodeError(showErrors ? r.error : ''); return; }
    loadImages(r.data).then(() => { decoded = r.data; showCodeError(''); showSummary(); });
  }
  $('ordercode').addEventListener('input',  () => tryDecode(false));
  $('ordercode').addEventListener('change', () => tryDecode(true));

  // ---- Card + address helpers ----
  $('card-number').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim();
  });
  $('card-exp').addEventListener('input', e => {
    let d = e.target.value.replace(/\D/g,'').slice(0,4);
    e.target.value = d.length > 2 ? d.slice(0,2) + '/' + d.slice(2) : d;
  });
  $('card-cvc').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g,'').slice(0,4); });

  const same = $('baddr-shaddr');
  function syncBilling(){
    const b = $('billing-address');
    if(same.checked){ b.value = $('address').value; b.readOnly = true; }
    else { b.readOnly = false; }
  }
  same.disabled = false;
  same.addEventListener('change', syncBilling);
  $('address').addEventListener('input', () => same.checked && syncBilling());

  function checkPayment(){
    const digits = $('card-number').value.replace(/\D/g,'');
    if(digits.length < 13) return 'Enter a full card number (the demo card is 4242 4242 4242 4242).';
    const m = /^(\d{2})\/(\d{2})$/.exec($('card-exp').value);
    if(!m || +m[1] < 1 || +m[1] > 12) return 'Enter the expiry as MM/YY.';
    const now = new Date();
    if(2000 + +m[2] < now.getFullYear() || (2000 + +m[2] === now.getFullYear() && +m[1] < now.getMonth() + 1)) return 'That card has expired.';
    if($('card-cvc').value.length < 3) return 'Enter the 3 or 4 digit CVC.';
    return '';
  }

  // ---- Fake checkout ----
  const form = $('ordercode').form;
  form.addEventListener('submit', e => {
    e.preventDefault();                          // nothing is ever sent anywhere
    const fe = $('formError');
    fe.hidden = true;
    if(!decoded){ showCodeError('We need a valid order code before we can place your order.'); $('ordercode').focus(); return; }
    const err = checkPayment();
    if(err){ fe.textContent = err; fe.hidden = false; return; }

    const btn = $('submit');
    btn.disabled = true; btn.value = 'Processing…';
    setTimeout(() => {
      $('confNum').textContent = '#ZS-' + (decoded.tk || Math.floor(100000 + Math.random()*900000));
      $('confDetail').textContent = decoded._qty + ' × custom tee, size ' + (decoded.sz||'—') + ', total ' + money(decoded._total) +
        '. Shipping to ' + $('address').value + '.' +
        ($('emailupdate').checked && $('contact').value ? ' Updates would go to ' + $('contact').value + '.' : '');
      ['card-number','card-exp','card-cvc'].forEach(id => $(id).value = '');
      form.hidden = true;
      $('confirmation').hidden = false;
      window.scrollTo({top:0, behavior:'smooth'});
    }, 1400);
  });
})();
</script>
