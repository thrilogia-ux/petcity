import {
  isPaymentsEnabled, serviceLabels, stateLabels, getClient, esc, status,
  openModal as open, closeModal, fillAccountPanel, setServiceMessageTimer, clearServiceMessageTimer, signedPhoto, uploadPhoto,
  createMapPinIcon, formatMapPrice, serviceIcon,
} from './core.js';
import { initShell, setView, onPetCityViewChange, syncViewFromHash } from './shell.js';

export function bootPetCity() {
  initShell();
  window.__petcitySetView = setView;
  window.__petcitySyncHash = syncViewFromHash;
  let ensureAccountScreen = async () => {};
  onPetCityViewChange(name => {
    if (name === 'community') community();
    if (name === 'shop') shopPage();
  });
  let marketplaceReady = false;
  let enhancedReady = false;
  let accountTab = 'pets';
  const careNav = document.createElement('button');
  careNav.className = 'navpill';
  careNav.textContent = 'Mis cuidados';
  careNav.hidden = true;
  const communityNav=document.createElement('button');
  communityNav.className='navpill';
  communityNav.textContent='Comunidad';
  const accountNav = document.createElement('button');
  accountNav.id = 'account-nav';
  accountNav.className = 'navpill';
  accountNav.textContent = 'Mi perfil';
  accountNav.hidden = true;
  const loginNav = document.querySelector('#login-nav');
  if (loginNav) {
    loginNav.before(accountNav);
    accountNav.before(careNav);
    careNav.before(communityNav);
  }
  communityNav.onclick = () => setView('community');
  accountNav.onclick = () => { accountTab = 'pets'; accountHome(); };
  careNav.onclick = () => { accountTab = 'services'; accountHome(); };
  const modal = document.querySelector('#modal-content');

  function renderAccountSidebar(isAdmin) {
    const nav = document.getElementById('account-sidebar-nav');
    if (!nav) return;
    const items = [
      ['pets', 'Mis mascotas'],
      ['services', 'Mis cuidados'],
      ['personal', 'Mis datos'],
      ['sitter', 'Modo cuidador'],
    ];
    nav.innerHTML = items.map(([key, label]) =>
      `<button type="button" class="account-sidebar-link${accountTab === key ? ' active' : ''}" data-account-tab="${key}">${label}</button>`
    ).join('')
      + `<button type="button" class="account-sidebar-link" data-go-community>Comunidad</button>`
      + (isAdmin ? '<button type="button" class="account-sidebar-link" id="sidebar-admin">Moderación admin</button>' : '');
    nav.querySelectorAll('[data-account-tab]').forEach(btn => {
      btn.onclick = () => { accountTab = btn.dataset.accountTab; dashboard(); };
    });
    nav.querySelector('[data-go-community]')?.addEventListener('click', () => { setView('community'); community(); });
    nav.querySelector('#sidebar-admin')?.addEventListener('click', moderation);
  }
  function bindLoginNav() {
    const btn = document.querySelector('#login-nav');
    if (!btn || btn.dataset.petcityLoginBound) return;
    btn.dataset.petcityLoginBound = '1';
    btn.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      openSignIn();
    }, true);
  }

  function loginFormHtml(mode = 'signin') {
    return `<form id="account-form" class="account-form">
      ${mode === 'signup' ? '<label>Nombre<input name="name" required maxlength="100" autocomplete="name"></label>' : ''}
      <label>Email<input name="email" type="email" required autocomplete="email"></label>
      <label>Contraseña<input name="password" type="password" required minlength="8" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}"></label>
      <button class="primary" type="submit">${mode === 'signup' ? 'Crear cuenta' : 'Ingresar'}</button>
    </form>
    <button type="button" class="secondary" id="switch-account" style="margin-top:12px">${mode === 'signup' ? 'Ya tengo cuenta' : 'Crear una cuenta'}</button>
    ${mode === 'signin' ? '<button type="button" class="secondary" id="forgot-password" style="margin-top:8px">Olvidé mi contraseña</button>' : ''}`;
  }

  function wireLoginForm(mode = 'signin') {
    document.getElementById('switch-account')?.addEventListener('click', () => showLoginPanel(mode === 'signup' ? 'signin' : 'signup'));
    document.getElementById('forgot-password')?.addEventListener('click', async () => {
      const email = String(document.querySelector('#account-form input[name=email]')?.value || '').trim();
      if (!email) { status('Ingresá tu email para recibir el enlace de recuperación.'); return; }
      status('Enviando enlace…');
      try {
        const { error } = await getClient().auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/' });
        if (error) throw error;
        status('Revisá tu email. El enlace vuelve a PetCity para elegir una contraseña nueva.');
      } catch (error) { status(error.message || 'No pudimos enviar el enlace.'); }
    });
    document.getElementById('account-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const button = event.target.querySelector('button[type=submit]');
      button.disabled = true;
      status('Entrando…');
      closeModal();
      try {
        const form = new FormData(event.target);
        const email = String(form.get('email')).trim();
        const password = String(form.get('password'));
        const authCall = mode === 'signup'
          ? getClient().auth.signUp({ email, password, options: { data: { full_name: String(form.get('name')).trim() }, emailRedirectTo: location.origin + '/' } })
          : getClient().auth.signInWithPassword({ email, password });
        const result = await Promise.race([
          authCall,
          new Promise((_, reject) => setTimeout(() => reject(new Error('La conexión tardó demasiado. Revisá tu internet e intentá de nuevo.')), 25000)),
        ]);
        if (result.error) throw result.error;
        if (result.data.session) {
          status('Cargando tu cuenta…');
          await dashboard();
          await syncNav();
          status('');
        } else {
          status(mode === 'signup'
            ? 'Te enviamos un email de confirmación. Abrilo desde este dispositivo y volvé a ingresar.'
            : 'Si tu cuenta no está confirmada, revisá el email de PetCity o pedí un enlace nuevo desde registro.');
        }
      } catch (error) {
        const msg = error.message || 'No se pudo completar el acceso.';
        status(/invalid login credentials/i.test(msg)
          ? 'Email o contraseña incorrectos. Si acabás de registrarte, confirmá el email antes de ingresar.'
          : msg);
      } finally {
        button.disabled = false;
      }
    });
  }

  function showLoginPanel(mode = 'signin') {
    closeModal();
    setView('account', location.hash.replace(/^#\/?/, '').split('/')[0].toLowerCase() !== 'cuenta');
    fillAccountPanel(`<header class="account-panel-head"><div><div class="eyebrow">CUENTA PETCITY</div><h2 id="dialog-title">${mode === 'signup' ? 'Crear cuenta' : 'Ingresá a tu cuenta'}</h2><p class="fine">Tus mascotas y postulaciones quedan guardadas en tu cuenta.</p></div></header><div class="account-panel-body">${loginFormHtml(mode)}</div>`);
    wireLoginForm(mode);
  }

  function openSignIn() {
    showLoginPanel('signin');
  }

  const login = (mode = 'signin') => showLoginPanel(mode);
  window.__petcitySignIn = openSignIn;
  bindLoginNav();
  let accountScreenBusy = false;
  ensureAccountScreen = async () => {
    if (accountScreenBusy) return;
    accountScreenBusy = true;
    try {
      const { data, error } = await getClient().auth.getUser();
      if (error || !data.user) openSignIn();
      else await dashboard();
    } catch (error) {
      open(`<h2 id="dialog-title">Cuenta PetCity</h2><p>${esc(error.message)}</p>`);
    } finally {
      accountScreenBusy = false;
    }
  };
  window.__petcityOpenAccount = () => ensureAccountScreen();
  async function accountHome() {
    await ensureAccountScreen();
  }
  async function dashboard() {
    try {
      closeModal();
      status('');
      const api = getClient();
      const { data: auth } = await api.auth.getUser();
      if (!auth.user) return login();
      const [profileRes, petsRes, applicationRes, adminRes, bookingsRes] = await Promise.all([
        api.from('profiles').select('*').eq('id', auth.user.id).maybeSingle(),
        api.from('pets').select('*').order('created_at', {ascending:false}),
        api.from('sitter_applications').select('*').eq('user_id', auth.user.id).maybeSingle(),
        api.rpc('petcity_is_admin'),
        api.from('bookings').select('id,owner_id,pet_id,offer_id,start_date,end_date,total_price_ars,status').order('created_at', {ascending:false}).limit(20),
      ]);
      let profile = profileRes.data;
      if (!profile && !profileRes.error) {
        const display_name = auth.user.user_metadata?.full_name || auth.user.email?.split('@')[0] || 'Usuario';
        const created = await api.from('profiles').insert({ id: auth.user.id, display_name }).select('*').single();
        if (created.error) throw created.error;
        profile = created.data;
      }
      const pets = petsRes.data;
      const application = applicationRes.data;
      const isAdmin = adminRes.error ? false : Boolean(adminRes.data);
      const bookings = bookingsRes.data;
      const profileError = profileRes.error;
      const petsError = petsRes.error;
      const applicationError = applicationRes.error;
      const bookingsError = bookingsRes.error;
      if (profileError || petsError || applicationError) throw profileError || petsError || applicationError;
      enhancedReady = Object.hasOwn(profile,'phone');
      marketplaceReady = !bookingsError;
      const bookingList = bookings || [];
      setView('account');
      renderAccountSidebar(isAdmin);
      const petCards = pets.length ? pets.map(p=>`<div class="dash-tile" style="margin:10px 0"><div style="display:flex;align-items:center;gap:16px"><span data-pet-photo="${esc(p.photo_path||'')}" style="width:72px;height:72px;border-radius:18px;background:#e8f1e9;display:grid;place-items:center;overflow:hidden">🐾</span><div><h3>${esc(p.name)}</h3><p>${esc(p.species)}${p.breed?' · '+esc(p.breed):''}${p.size?' · '+esc(p.size):''}${p.weight_kg?' · '+esc(p.weight_kg)+' kg':''}</p></div></div><p>${esc(p.care_notes||'Sin indicaciones cargadas.')}</p><button class="dash-call" data-edit-pet="${esc(p.id)}">Ver y editar ficha</button></div>`).join('') : '<p>Todavía no cargaste mascotas.</p>';
      const serviceCards = bookingsError ? '<p>Estamos habilitando las solicitudes.</p>' : bookingList.length ? bookingList.map(b=>`<div class="dash-tile" style="margin:10px 0"><strong>${b.owner_id===auth.user.id?'Cuidado solicitado':'Cuidado recibido'} · ${esc(stateLabels[b.status] || b.status)}</strong><p>${esc(b.start_date)}${b.end_date!==b.start_date?' al '+esc(b.end_date):''} · $${Number(b.total_price_ars).toLocaleString('es-AR')}</p><button class="dash-call" data-service="${esc(b.id)}">Ver servicio y novedades</button>${b.owner_id!==auth.user.id&&b.status==='pending'?` <button class="dash-call" data-booking="${esc(b.id)}" data-decision="accepted">Aceptar</button> <button class="secondary" data-booking="${esc(b.id)}" data-decision="rejected">Rechazar</button>`:b.owner_id===auth.user.id&&b.status==='pending'?` <button class="secondary" data-booking="${esc(b.id)}" data-decision="cancelled">Cancelar solicitud</button>`:''}</div>`).join('') : '<p>Todavía no tenés servicios. Encontrá un cuidador en las ofertas aprobadas.</p>';
      const contents = {
        pets: `<h3>Mis mascotas</h3>${petCards}<button class="primary" id="add-real-pet">Agregar mascota</button>`,
        services: `<h3>Mis cuidados</h3><p>Acá aparecen tus solicitudes, horarios y novedades del cuidado.</p>${serviceCards}`,
        personal: `<h3>Mis datos</h3><form id="profile-form" class="account-form"><label>Nombre<input name="display_name" maxlength="100" required value="${esc(profile.display_name)}"></label><label>Email<input value="${esc(auth.user.email)}" disabled></label>${enhancedReady?`<label>Teléfono<input name="phone" type="tel" maxlength="40" value="${esc(profile.phone)}"></label><label>Dirección<input name="address" maxlength="200" autocomplete="street-address" value="${esc(profile.address)}"></label><label>Ciudad<input name="city" maxlength="100" autocomplete="address-level2" value="${esc(profile.city)}"></label>`:'<p>Teléfono y dirección se habilitarán con la próxima actualización.</p>'}<button class="primary">Guardar datos</button></form><p class="fine">Tu dirección y teléfono son privados.</p>`,
        sitter: `<h3>Quiero cuidar mascotas</h3><p>${application ? `Postulación: ${esc(stateLabels[application.status] || application.status)}${application.review_note ? ' · '+esc(application.review_note) : ''}` : 'Tu oferta necesita revisión antes de publicarse.'}</p>
          ${application?.status === 'approved' ? `<p class="fine">${application.lat != null && application.lng != null ? 'Tu ubicación ya está en el mapa público (zona aproximada).' : 'Para aparecer en el mapa de la home, marcá tu zona una vez.'}</p>` : ''}
          <button class="dash-call" id="real-application">${application ? 'Ver postulación' : 'Empezar postulación'}</button>
          ${application?.status === 'approved' ? '<button class="dash-call" id="sitter-map-location">Marcar mi zona en el mapa</button><button class="dash-call" id="manage-offers">Mis servicios y precios</button><button class="secondary" id="manage-availability">Agenda y disponibilidad</button><button class="secondary" id="upload-offer-photo">Subir foto de mi oferta</button>' : ''}`,
        community: ''
      };
      fillAccountPanel(`<header class="account-panel-head"><div><div class="eyebrow">MI CUENTA</div><h2 id="dialog-title">Hola, ${esc(profile.display_name || auth.user.email)}</h2><p class="fine">Gestioná mascotas, servicios y tu perfil de cuidador desde un solo lugar.</p></div><button type="button" class="secondary" id="real-signout">Cerrar sesión</button></header><div class="account-panel-body">${contents[accountTab]||contents.pets}</div>`);
      document.querySelector('#add-real-pet')?.addEventListener('click',petForm);
      document.querySelectorAll('[data-edit-pet]').forEach(button=>button.onclick=()=>petForm(pets.find(p=>p.id===button.dataset.editPet)));
      document.querySelectorAll('[data-pet-photo]').forEach(async node=>{if(node.dataset.petPhoto){const url=await signedPhoto(node.dataset.petPhoto);if(url)node.innerHTML=`<img src="${esc(url)}" alt="" style="width:100%;height:100%;object-fit:cover">`;}});
      document.querySelectorAll('[data-service]').forEach(button=>button.onclick=()=>serviceDetail(bookingList.find(b=>b.id===button.dataset.service),auth.user.id));
      document.querySelector('#profile-form')?.addEventListener('submit',async event=>{event.preventDefault();const form=new FormData(event.target);const changes={display_name:String(form.get('display_name')).trim()};if(enhancedReady)Object.assign(changes,{phone:String(form.get('phone')).trim(),address:String(form.get('address')).trim(),city:String(form.get('city')).trim()});const {error}=await api.from('profiles').update(changes).eq('id',auth.user.id);if(error)status(error.message);else dashboard();});
      document.querySelector('#real-application')?.addEventListener('click',()=>applicationForm(application));
      document.querySelector('#manage-offers')?.addEventListener('click',()=>sitterOffersManager(application));
      document.querySelector('#manage-availability')?.addEventListener('click',()=>sitterAvailabilityForm(application));
      document.querySelector('#upload-offer-photo')?.addEventListener('click',()=>sitterPhotoUpload(application));
      document.querySelector('#sitter-map-location')?.addEventListener('click', () => sitterSetMapLocation(application));
      document.querySelector('#open-community')?.addEventListener('click', () => { setView('community'); community(); });
      document.querySelectorAll('[data-booking]').forEach(button=>button.onclick=async()=>{
        button.disabled=true;
        const result=button.dataset.decision==='cancelled'
          ? await api.rpc('petcity_cancel_pending_booking',{chosen_booking:button.dataset.booking})
          : await api.rpc('petcity_decide_booking',{chosen_booking:button.dataset.booking,decision:button.dataset.decision});
        if(result.error){status(result.error.message);button.disabled=false;}else dashboard();
      });
      await syncNav();
      document.querySelector('#real-signout').onclick = async () => {
        await api.auth.signOut();
        await syncNav();
        closeModal();
        status('');
        openSignIn();
      };
    } catch (error) { open(`<h2 id="dialog-title">Cuenta PetCity</h2><p>No pudimos cargar tus datos: ${esc(error.message)}</p><button class="secondary" id="retry-account">Reintentar</button>`); document.querySelector('#retry-account').onclick = dashboard; }
  }
  async function moderation() {
    const api=getClient();
    const {data:pending,error}=await api.from('sitter_applications')
      .select('id,city,bio,experience,created_at,sitter_offers(service,price_ars,unit)')
      .eq('status','pending').order('created_at',{ascending:true});
    if(error) {open(`<h2 id="dialog-title">Moderación</h2><p>${esc(error.message)}</p>`);return;}
    open(`<div class="eyebrow">PETCITY · MODERACIÓN</div><h2 id="dialog-title">Postulaciones pendientes</h2>
      ${pending.length ? pending.map(a=>`<div class="dash-tile" style="margin:12px 0"><strong>${esc(a.city)}</strong><p>${esc(a.bio)}</p><p>Experiencia: ${esc(a.experience)}</p>
        <p>${a.sitter_offers.map(o=>`${esc(o.service)} · $${Number(o.price_ars).toLocaleString('es-AR')} por ${esc(o.unit)}`).join('<br>')}</p>
        <label style="display:block;margin:12px 0"><input type="checkbox" data-verified="${esc(a.id)}"> Verifiqué identidad, experiencia y condiciones del servicio fuera de esta ficha</label>
        <button class="dash-call" data-review="${esc(a.id)}" data-decision="approved">Aprobar</button>
        <button class="secondary" data-review="${esc(a.id)}" data-decision="changes_requested">Pedir cambios</button>
        <button class="secondary" data-review="${esc(a.id)}" data-decision="rejected">Rechazar</button></div>`).join('') : '<p>No hay postulaciones pendientes.</p>'}
      <p id="account-status" role="status" aria-live="polite"></p><button class="secondary" id="review-community">Revisar comunidad</button><button class="secondary" id="back-account">Volver</button>`);
    document.querySelector('#back-account').onclick=dashboard;
    document.querySelector('#review-community').onclick=communityModeration;
    document.querySelectorAll('[data-review]').forEach(button=>button.onclick=async()=>{
      const decision=button.dataset.decision;
      if(decision==='approved' && !document.querySelector(`[data-verified="${button.dataset.review}"]`)?.checked) {
        status('Antes de aprobar, confirmá la verificación del cuidador.');return;
      }
      const note=decision==='approved'?null:prompt('Motivo para el cuidador:');
      if(decision!=='approved' && !note?.trim()) return;
      button.disabled=true;
      const {error:reviewError}=await api.rpc('petcity_review_application',{application_id:button.dataset.review,decision,note});
      if(reviewError){status(reviewError.message);button.disabled=false;}else {moderation();refreshRealOffers();}
    });
  }
  async function communityModeration() {
    const api=getClient();
    const [{data:posts,error},{data:comments}]=await Promise.all([
      api.from('community_posts').select('id,caption,photo_path').eq('status','pending').order('created_at'),
      api.from('community_comments').select('id,body').eq('status','pending').order('created_at')
    ]);
    if(error){open(`<h2 id="dialog-title">Moderación</h2><p>${esc(error.message)}</p>`);return;}
    open(`<div class="eyebrow">PETCITY · COMUNIDAD</div><h2 id="dialog-title">Contenido pendiente</h2>${[...(posts||[]).map(p=>({kind:'post',id:p.id,body:p.caption,path:p.photo_path})),...(comments||[]).map(c=>({kind:'comment',id:c.id,body:c.body}))].map(item=>`<div class="dash-tile" style="margin:12px 0"><strong>${item.kind==='post'?'Publicación':'Comentario'}</strong><p>${esc(item.body)}</p><div data-moderate-photo="${esc(item.path||'')}"></div><button class="dash-call" data-content="${esc(item.id)}" data-kind="${item.kind}" data-decision="approved">Aprobar</button> <button class="secondary" data-content="${esc(item.id)}" data-kind="${item.kind}" data-decision="rejected">Rechazar</button></div>`).join('')||'<p>No hay contenido pendiente.</p>'}<p id="account-status" role="status"></p><button class="secondary" id="back-account">Volver</button>`);
    document.querySelector('#back-account').onclick=moderation;
    document.querySelectorAll('[data-moderate-photo]').forEach(async node=>{const url=await signedPhoto(node.dataset.moderatePhoto);if(url)node.innerHTML=`<img src="${esc(url)}" alt="Foto pendiente" style="max-width:100%;max-height:300px;border-radius:16px">`;});
    document.querySelectorAll('[data-content]').forEach(button=>button.onclick=async()=>{button.disabled=true;const {error:reviewError}=await api.rpc('petcity_review_content',{kind:button.dataset.kind,content_id:button.dataset.content,decision:button.dataset.decision});if(reviewError){status(reviewError.message);button.disabled=false;}else communityModeration();});
  }
  function petForm(existing) {
    if (!existing?.id) existing=null;
    open(`<div class="eyebrow">MI MASCOTA</div><h2 id="dialog-title">${existing?'Ficha de '+esc(existing.name):'Agregar mascota'}</h2><form id="real-pet-form" class="account-form">
      <label>Nombre<input name="name" required maxlength="80" value="${esc(existing?.name)}"></label><label>Tipo<select name="species"><option value="perro">Perro</option><option value="gato">Gato</option><option value="otro">Otro</option></select></label>
      ${enhancedReady?`<label>Raza o mezcla<input name="breed" maxlength="100" value="${esc(existing?.breed)}"></label><label>Peso (kg)<input name="weight_kg" type="number" step="0.01" min="0.01" max="300" value="${esc(existing?.weight_kg)}"></label>
      <label>Tamaño<select name="size"><option value="">Sin especificar</option><option value="pequeño">Pequeño</option><option value="mediano">Mediano</option><option value="grande">Grande</option></select></label>
      <label>Foto de tu mascota<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label>`:'<p>La foto, peso y tamaño se habilitarán con la próxima actualización.</p>'}
      <label>Rutina, alimentación, salud y comentarios<textarea name="care_notes" maxlength="3000" placeholder="Indicaciones para quien la cuide">${esc(existing?.care_notes)}</textarea></label>
      <button class="primary" type="submit">${existing?'Guardar cambios':'Guardar mascota'}</button></form><p id="account-status" role="status"></p><button class="secondary" id="back-account">Volver a mis mascotas</button>`);
    document.querySelector('[name=species]').value=existing?.species||'perro';
    if(enhancedReady)document.querySelector('[name=size]').value=existing?.size||'';
    document.querySelector('#back-account').onclick = dashboard;
    document.querySelector('#real-pet-form').onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.target);
      const button=event.target.querySelector('button[type=submit]');button.disabled=true;
      try {
        const basic={name:String(form.get('name')).trim(),species:form.get('species'),care_notes:String(form.get('care_notes')).trim()};
        const details=enhancedReady?{breed:String(form.get('breed')).trim(),weight_kg:form.get('weight_kg')?Number(form.get('weight_kg')):null,size:form.get('size')||null}:{};
        const api=getClient();
        const result=existing?await api.from('pets').update({...basic,...details}).eq('id',existing.id).select('id').single():await api.from('pets').insert({...basic,...details}).select('id').single();
        if(result.error)throw result.error;
        const photo=form.get('photo');
        if(photo?.size){const path=await uploadPhoto(photo,`pets/${result.data.id}`);const {error}=await api.from('pets').update({photo_path:path}).eq('id',result.data.id);if(error)throw error;}
        accountTab='pets';dashboard();
      }catch(error){status(error.message);button.disabled=false;}
    };
  }
  function openServicesHub() {
    closeModal();
    accountTab = 'services';
    setView('account', true);
    void dashboard();
  }
  async function serviceDetail(booking,userId) {
    closeModal();
    setView('account');
    accountTab = 'services';
    const api=getClient();
    const [{data:offer},{data:pet},{data:updates,error},{data:isAdmin}]=await Promise.all([
      api.from('sitter_offers').select('service,unit,sitter_applications(public_name)').eq('id',booking.offer_id).single(),
      api.from('pets').select('name,care_notes').eq('id',booking.pet_id).maybeSingle(),
      api.from('care_updates').select('id,message,photo_path,created_at').eq('booking_id',booking.id).order('created_at',{ascending:false}),
      api.rpc('petcity_is_admin'),
    ]);
    renderAccountSidebar(Boolean(isAdmin));
    const sitter=booking.owner_id!==userId;
    const owner=!sitter;
    const timeline=['pending','accepted','in_progress','completed'].map(s=>`<span class="timeline-step ${['pending','accepted','in_progress','completed'].indexOf(booking.status)>=['pending','accepted','in_progress','completed'].indexOf(s)?'done':''}">${esc(stateLabels[s]||s)}</span>`).join('');
    const actions=sitter&&booking.status==='accepted'?'<button class="primary" id="start-service">Iniciar servicio</button>':'';
    const actions2=sitter&&booking.status==='in_progress'?'<button class="primary" id="complete-service">Finalizar servicio</button>':'';
    const actions3 = owner && booking.status === 'completed'
      ? `<form id="review-form" class="account-form"><h3>Tu reseña</h3><label>Puntuación<select name="rating" required><option value="">Elegí</option>${[5, 4, 3, 2, 1].map(n => `<option value="${n}">${n} estrellas</option>`).join('')}</select></label><label>Comentario<textarea name="body" minlength="10" maxlength="2000" required></textarea></label><button class="primary">Enviar reseña</button></form>`
      : '';
    const payBtn=owner&&isPaymentsEnabled()&&['accepted','payment_pending'].includes(booking.status)?`<button class="primary" id="pay-booking">${booking.status==='payment_pending'?'Reintentar pago MP':'Pagar con Mercado Pago (sandbox)'}</button>`:'';
    const walkStats = '<p id="walk-track-stats" class="fine walk-track-stats">Esperando puntos GPS…</p>';
    const walk=booking.status==='in_progress'&&offer?.service==='paseo'&&sitter?`<div class="dash-tile" id="walk-track"><h3>Seguimiento del paseo</h3><p class="fine">Solo compartí ubicación durante el paseo activo. Podés detenerla cuando termines.</p><div class="walk-gps-actions"><button type="button" class="primary" id="walk-start">Activar GPS</button><button type="button" class="secondary" id="walk-stop" hidden>Detener GPS</button></div>${walkStats}<div id="walk-map" class="mapwrap walk-map-live"></div></div>':'';
    const walkOwner=booking.status==='in_progress'&&offer?.service==='paseo'&&owner?`<div class="dash-tile"><h3>Mapa del paseo en vivo</h3><p class="fine">Se actualiza mientras el cuidador comparte ubicación.</p>${walkStats}<div id="walk-map" class="mapwrap walk-map-live"></div></div>':'';
    const actionRow=[payBtn,actions,actions2].filter(Boolean).join('');
    fillAccountPanel(`<header class="account-panel-head service-detail-head"><div>
      <button type="button" class="secondary service-back" id="back-services">← Mis cuidados</button>
      <div class="eyebrow" style="margin-top:14px">MI SERVICIO</div>
      <h2 id="dialog-title">${esc(serviceLabels[offer?.service]||'Cuidado de mascotas')}</h2>
    </div></header>
    <div class="account-panel-body service-detail-body">
      <div class="service-timeline">${timeline}</div>
      <div class="service-detail-summary dash-tile">
        <p><strong>${esc(pet?.name||'Mascota')}</strong> · ${esc(offer?.sitter_applications?.public_name||'Cuidador')}</p>
        <p class="fine">${esc(stateLabels[booking.status]||booking.status)} · ${esc(booking.start_date)}${booking.end_date!==booking.start_date?' al '+esc(booking.end_date):''}</p>
        <p class="service-detail-price">$${Number(booking.total_price_ars).toLocaleString('es-AR')}</p>
      </div>
      ${actionRow?`<div class="service-detail-actions">${actionRow}</div>`:''}
      ${sitter&&pet?.care_notes?`<div class="dash-tile"><h3>Indicaciones del dueño</h3><p>${esc(pet.care_notes)}</p></div>`:''}
      <section class="dash-tile"><h3>Mensajes del servicio</h3><p class="fine">Coordinación privada entre dueño y cuidador.</p>
        <div id="service-messages" class="message-list" aria-label="Mensajes del servicio">Cargando conversación…</div>
        <form id="service-message-form" class="chat-form" hidden><label for="service-message-input" class="visually-hidden">Tu mensaje</label><input id="service-message-input" name="body" maxlength="2000" required placeholder="Coordiná horarios o consultá cómo va el cuidado" autocomplete="off"><button class="primary" type="submit">Enviar</button></form>
        <p id="service-message-status" class="fine" role="status" aria-live="polite"></p>
      </section>
      <div class="dash-tile"><h3>Novedades y fotos</h3>${error?'<p>Las novedades se habilitarán tras aplicar migraciones en Supabase.</p>':updates.length?updates.map(u=>`<div class="care-update-row"><small>${new Date(u.created_at).toLocaleString('es-AR')}</small><p>${esc(u.message)}</p><div data-update-photo="${esc(u.photo_path||'')}"></div></div>`).join(''):'<p>El cuidador todavía no compartió novedades.</p>'}</div>
      ${sitter&&['accepted','in_progress'].includes(booking.status)&&!error?'<form id="care-update-form" class="account-form dash-tile"><h3>Compartir novedad</h3><label>Mensaje<textarea name="message" maxlength="1000" required placeholder="Contale al dueño cómo va el cuidado"></textarea></label><label>Foto opcional<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><button class="primary">Publicar novedad</button></form>':''}
      ${walk}${walkOwner}${actions3}
    </div>`);
    document.querySelector('#back-services')?.addEventListener('click', () => openServicesHub());
    await serviceMessages(booking,userId);
    document.querySelectorAll('[data-update-photo]').forEach(async node=>{const url=await signedPhoto(node.dataset.updatePhoto);if(url)node.innerHTML=`<img src="${esc(url)}" alt="Foto de la novedad" style="max-width:100%;border-radius:16px">`;});
    document.querySelector('#care-update-form')?.addEventListener('submit',async event=>{event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;try{const form=new FormData(event.target);const path=await uploadPhoto(form.get('photo'),`care/${booking.id}`);const {error:saveError}=await api.from('care_updates').insert({booking_id:booking.id,sitter_id:userId,message:String(form.get('message')).trim(),photo_path:path});if(saveError)throw saveError;serviceDetail(booking,userId);}catch(e){status(e.message);button.disabled=false;}});
    document.querySelector('#start-service')?.addEventListener('click',async()=>{const {error}=await api.rpc('petcity_start_service',{chosen_booking:booking.id});if(error)status(error.message);else serviceDetail({...booking,status:'in_progress'},userId);});
    document.querySelector('#complete-service')?.addEventListener('click',async()=>{const {error}=await api.rpc('petcity_complete_service',{chosen_booking:booking.id});if(error)status(error.message);else serviceDetail({...booking,status:'completed'},userId);});
    document.querySelector('#review-form')?.addEventListener('submit',async ev=>{ev.preventDefault();const f=new FormData(ev.target);const {error}=await api.rpc('petcity_submit_review',{chosen_booking:booking.id,p_rating:Number(f.get('rating')),p_body:String(f.get('body')).trim()});if(error)status(error.message);else{status('Gracias por tu reseña.');serviceDetail({...booking,status:'completed'},userId);}});
    document.querySelector('#pay-booking')?.addEventListener('click',async()=>{
      try{
        const { data: { session } } = await api.auth.getSession();
        if (!session?.access_token) throw new Error('Ingresá de nuevo para pagar.');
        const res=await fetch('/api/mp/create-preference',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({booking_id:booking.id})});
        const data=await res.json();
        if(!res.ok)throw new Error(data.error||'No se pudo iniciar el pago');
        if(data.init_point)location.href=data.init_point;
        else status('Preferencia creada (sandbox).');
      }catch(e){status(e.message);}
    });
    initWalkTracking(booking,userId,sitter,offer?.service==='paseo');
  }
  async function serviceMessages(booking,userId) {
    const api=getClient();
    const list=document.querySelector('#service-messages');
    const form=document.querySelector('#service-message-form');
    const notice=document.querySelector('#service-message-status');
    if(!list||!form||!notice)return;
    let refreshing=false;
    let messageSignature='';
    const refresh=async()=>{
      if(refreshing)return;
      refreshing=true;
      try{
        const {data,error}=await api.from('booking_messages').select('id,sender_id,body,created_at').eq('booking_id',booking.id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100);
        if(!list.isConnected)return;
        if(error){list.textContent='La mensajería todavía no está disponible.';notice.textContent='Se habilitará al completar la actualización de PetCity.';return false;}
        const messages=(data||[]).slice().reverse();
        const signature=JSON.stringify(messages);
        if(signature!==messageSignature){
          const atBottom=list.scrollHeight-list.scrollTop-list.clientHeight<70||!messageSignature;
          list.innerHTML=messages.length?messages.map(m=>`<div class="bubble ${m.sender_id===userId?'mine':''}"><strong>${m.sender_id===userId?'Vos':m.sender_id===booking.owner_id?'Dueño':'Cuidador'}</strong><div style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(m.body)}</div><small>${new Date(m.created_at).toLocaleString('es-AR')}</small></div>`).join(''):'<p>Todavía no hay mensajes. Podés empezar coordinando el horario.</p>';
          messageSignature=signature;
          if(atBottom)list.scrollTop=list.scrollHeight;
        }
        return true;
      }catch{if(list.isConnected)notice.textContent='No pudimos actualizar la conversación. Reintentá en unos segundos.';return false;}
      finally{refreshing=false;}
    };
    const ready=await refresh();
    if(!list.isConnected||!ready)return;
    const writable=['pending','accepted','in_progress'].includes(booking.status);
    form.hidden=!writable;
    notice.textContent=writable?'La conversación se actualiza automáticamente mientras estás acá.':'Este servicio está cerrado. Podés consultar los mensajes anteriores.';
    form.onsubmit=async event=>{
      event.preventDefault();
      const input=form.querySelector('input');
      const body=input.value.trim();
      if(!body)return;
      const button=form.querySelector('button');button.disabled=true;
      try{
        const {error}=await api.from('booking_messages').insert({booking_id:booking.id,sender_id:userId,body});
        if(error)throw error;
        if(!form.isConnected)return;
        input.value='';notice.textContent='Mensaje enviado.';
        await refresh();
      }catch(error){if(notice.isConnected)notice.textContent=`No se pudo enviar: ${error.message||'reintentá en unos segundos'}`;}
      finally{button.disabled=false;}
    };
    setServiceMessageTimer(setInterval(()=>{
      if(!list.isConnected){clearServiceMessageTimer();return;}
      if(!document.hidden)refresh();
    },8000));
  }
  let communityBusy = false;
  async function community() {
    if (communityBusy) return;
    communityBusy = true;
    const api = getClient();
    const { data: auth } = await api.auth.getUser();
    const composeBtn = document.getElementById('community-compose-btn');
    const composerWrap = document.getElementById('community-composer-wrap');
    const feed = document.getElementById('community-feed');
    if (!feed) { communityBusy = false; return; }
    if (composeBtn) {
      composeBtn.hidden = !auth.user;
      composeBtn.onclick = () => {
        composerWrap.hidden = !composerWrap.hidden;
        if (!composerWrap.hidden) composerWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
    }
    if (auth.user) {
      composerWrap.innerHTML = `<form id="post-form" class="ig-composer account-form"><label class="ig-upload"><span>Seleccionar foto</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required></label><label>Contá la historia<textarea name="caption" maxlength="1500" required placeholder="¿Qué pasó hoy con tu mascota?"></textarea></label><button class="primary" type="submit">Enviar para revisión</button><p class="fine">Visible 30 días tras aprobación.</p></form>`;
      composerWrap.hidden = true;
    } else {
      composerWrap.innerHTML = `<p class="fine">Ingresá para publicar historias reales.</p><button type="button" class="primary" id="community-login">Ingresar</button>`;
      composerWrap.hidden = false;
      composerWrap.querySelector('#community-login')?.addEventListener('click', login);
    }
    feed.innerHTML = '<p class="fine ig-loading">Cargando historias…</p>';
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: posts, error }, pendingRes] = await Promise.all([
      api.from('community_posts').select('*').eq('status', 'approved').gte('created_at', cutoff).order('created_at', { ascending: false }).limit(40),
      auth.user
        ? api.from('community_posts').select('id,caption,photo_path,created_at').eq('author_id', auth.user.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(10)
        : Promise.resolve({ data: [] }),
    ]);
    if (error) { feed.innerHTML = `<p class="fine">${esc(error.message)}</p>`; communityBusy = false; return; }
    const postIds = (posts || []).map(p => p.id);
    const [{ data: likes }, { data: comments }] = await Promise.all([
      postIds.length ? api.from('community_likes').select('post_id,user_id').in('post_id', postIds) : Promise.resolve({ data: [] }),
      postIds.length ? api.from('community_comments').select('id,post_id,body,status,created_at').in('post_id', postIds).eq('status', 'approved').limit(200) : Promise.resolve({ data: [] }),
    ]);
    const igPost = p => {
      const likeCount = likes?.filter(l => l.post_id === p.id).length || 0;
      const postComments = (comments || []).filter(c => c.post_id === p.id && c.status === 'approved');
      return `<article id="post-${esc(p.id)}" class="ig-post"><header class="ig-post-head"><span class="ig-avatar">${esc((p.author_name || 'P')[0])}</span><div><strong>${esc(p.author_name || 'Miembro PetCity')}</strong><span class="fine">${esc(p.author_role || 'Miembro')} · ${new Date(p.created_at).toLocaleDateString('es-AR')}</span></div></header><div class="ig-post-media" data-post-photo="${esc(p.photo_path || '')}">${p.photo_path ? '' : '🐾'}</div><div class="ig-post-actions"><button type="button" class="ig-icon-btn" data-like="${esc(p.id)}" aria-label="Me gusta">♥ ${likeCount}</button><button type="button" class="ig-icon-btn" data-share="${esc(p.id)}">↗</button></div><p class="ig-caption"><strong>${esc(p.author_name || 'Miembro')}</strong> ${esc(p.caption)}</p>${postComments.map(c => `<p class="ig-comment">${esc(c.body)}</p>`).join('')}${auth.user ? `<form data-comment="${esc(p.id)}" class="ig-comment-form"><input name="body" maxlength="500" required placeholder="Agregar comentario…"><button type="submit" class="ig-send" aria-label="Enviar">›</button></form>` : ''}</article>`;
    };
    const examples = [
      { image: 'demo-walk.webp', title: 'Paseo de tarde', caption: 'Un paseo tranquilo por el barrio.' },
      { image: 'demo-park.webp', title: 'Descanso en el parque', caption: 'Agua y siesta después de jugar.' },
      { image: 'demo-cat.webp', title: 'Siesta junto a la ventana', caption: 'El rincón favorito al sol.' },
    ];
    const demoCards = (posts || []).length < 3 ? examples.map(item =>
      `<article class="ig-post ig-post-demo"><header class="ig-post-head"><span class="ig-avatar">✦</span><div><strong>Ejemplo PetCity</strong><span class="community-example">Simulación</span></div></header><div class="ig-post-media"><img src="/${item.image}" alt="${esc(item.title)}" loading="lazy"></div><p class="ig-caption"><strong>${esc(item.title)}</strong> ${esc(item.caption)}</p></article>`
    ).join('') : '';
    const pendingCards = (pendingRes.data || []).map(p =>
      `<article class="ig-post ig-post-pending"><header class="ig-post-head"><span class="ig-avatar">⏳</span><div><strong>Tu publicación</strong><span class="community-pending-badge">En revisión</span></div></header><div class="ig-post-media" data-post-photo="${esc(p.photo_path || '')}"></div><p class="ig-caption">${esc(p.caption)}</p><p class="fine">PetCity la mostrará acá cuando un admin la apruebe.</p></article>`,
    ).join('');
    feed.innerHTML = pendingCards + (posts || []).map(igPost).join('') + demoCards;
    document.querySelectorAll('[data-post-photo]').forEach(async node => {
      if (!node.dataset.postPhoto) return;
      const url = await signedPhoto(node.dataset.postPhoto);
      node.innerHTML = url ? `<img src="${esc(url)}" alt="Mascota en PetCity">` : 'Foto no disponible';
    });
    document.querySelector('#post-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const button = event.target.querySelector('button');
      button.disabled = true;
      try {
        const form = new FormData(event.target);
        const path = await uploadPhoto(form.get('photo'), 'community');
        const { error: saveError } = await api.from('community_posts').insert({ author_id: auth.user.id, caption: String(form.get('caption')).trim(), photo_path: path });
        if (saveError) throw saveError;
        community();
      } catch (e) { status(e.message); button.disabled = false; }
    });
    document.querySelectorAll('[data-like]').forEach(button => button.onclick = async () => {
      if (!auth.user) return login();
      const liked = likes?.some(l => l.post_id === button.dataset.like && l.user_id === auth.user.id);
      const q = liked ? api.from('community_likes').delete().eq('post_id', button.dataset.like).eq('user_id', auth.user.id) : api.from('community_likes').insert({ post_id: button.dataset.like, user_id: auth.user.id });
      const { error: likeError } = await q;
      if (likeError) status(likeError.message); else community();
    });
    document.querySelectorAll('[data-share]').forEach(button => button.onclick = async () => {
      const url = `${location.origin}/#/comunidad?post=${encodeURIComponent(button.dataset.share)}`;
      try {
        if (navigator.share) await navigator.share({ title: 'PetCity', url });
        else { await navigator.clipboard.writeText(url); status('Enlace copiado.'); }
      } catch (e) { if (e.name !== 'AbortError') status('No se pudo compartir.'); }
    });
    document.querySelectorAll('[data-comment]').forEach(form => form.onsubmit = async event => {
      event.preventDefault();
      const body = String(new FormData(form).get('body')).trim();
      const { error: commentError } = await api.from('community_comments').insert({ post_id: form.dataset.comment, author_id: auth.user.id, body });
      if (commentError) status(commentError.message); else community();
    });
    const sharedPost = new URLSearchParams(location.search).get('post');
    if (sharedPost) document.getElementById(`post-${sharedPost}`)?.scrollIntoView({ block: 'center' });
    communityBusy = false;
  }
  async function applicationForm(existing) {
    if (!marketplaceReady) {open('<h2 id="dialog-title">Postulaciones en preparación</h2><p>Estamos terminando de habilitar ofertas y solicitudes reales.</p><button class="secondary" id="back-account">Volver</button>');document.querySelector('#back-account').onclick=dashboard;return;}
    if (existing && !['draft','changes_requested'].includes(existing.status)) {
      open(`<div class="eyebrow">POSTULACIÓN</div><h2 id="dialog-title">Estado: ${esc(stateLabels[existing.status] || existing.status)}</h2><p>Tu oferta no aparecerá en la búsqueda hasta que PetCity la apruebe.</p><p>${esc(existing.review_note || '')}</p><button class="secondary" id="back-account">Volver</button>`);
      document.querySelector('#back-account').onclick = dashboard;
      return;
    }
    open(`<div class="eyebrow">QUIERO CUIDAR MASCOTAS</div><h2 id="dialog-title">Mi postulación</h2><p>PetCity revisará tu experiencia y tarifa antes de publicar la oferta.</p>
      <form id="real-sitter-form" class="account-form"><label>Nombre público<input name="public_name" required minlength="2" maxlength="80" value="${esc(existing?.public_name)}"></label><label>Ciudad o barrio<input name="city" required minlength="2" maxlength="100" value="${esc(existing?.city)}"></label>
      <label>Contanos cómo cuidás mascotas<textarea name="bio" required minlength="30" maxlength="2000">${esc(existing?.bio)}</textarea></label>
      <label>Tu experiencia<textarea name="experience" required minlength="20" maxlength="2000">${esc(existing?.experience)}</textarea></label>
      <label>Servicio<select name="service"><option value="paseo">Paseo</option><option value="cuidado_en_casa">Cuidado en casa</option><option value="alojamiento">Alojamiento</option><option value="vacaciones">Vacaciones</option></select></label>
      <label>Tu precio en ARS<input name="price_ars" type="number" min="1" max="100000000" required></label><button class="primary">Enviar para revisión</button></form>
      <p id="account-status" role="status" aria-live="polite"></p><button class="secondary" id="back-account">Volver</button>`);
    document.querySelector('#back-account').onclick = dashboard;
    document.querySelector('#real-sitter-form').onsubmit = async event => {
      event.preventDefault();
      const button=event.target.querySelector('button');button.disabled=true;status('Guardando postulación…');
      try {
        const api=getClient(), form=new FormData(event.target);
        const {data:auth}=await api.auth.getUser();if(!auth.user) throw new Error('Ingresá de nuevo para continuar.');
        const input={public_name:String(form.get('public_name')).trim(),city:String(form.get('city')).trim(),bio:String(form.get('bio')).trim(),experience:String(form.get('experience')).trim()};
        const app=existing
          ? await api.from('sitter_applications').update(input).eq('id',existing.id).select('id').single()
          : await api.from('sitter_applications').insert({...input,user_id:auth.user.id}).select('id').single();
        if(app.error) throw app.error;
        const service=String(form.get('service'));
        const unit=['alojamiento','vacaciones'].includes(service)?'noche':service==='paseo'?'paseo':'dia';
        const current=await api.from('sitter_offers').select('id').eq('sitter_id',app.data.id).eq('service',service).maybeSingle();
        if(current.error) throw current.error;
        const offer=current.data
          ? await api.from('sitter_offers').update({price_ars:Number(form.get('price_ars')),unit}).eq('id',current.data.id)
          : await api.from('sitter_offers').insert({sitter_id:app.data.id,service,price_ars:Number(form.get('price_ars')),unit});
        if(offer.error) throw offer.error;
        const submitted=await api.rpc('petcity_submit_application');if(submitted.error) throw submitted.error;
        dashboard();
      } catch(error) {status(error.message || 'No se pudo enviar. Tus datos quedan en el formulario.');button.disabled=false;}
    };
  }
  async function syncNav() {
    try {
      const {data:{user}} = await getClient().auth.getUser();
      accountNav.hidden = !user;
      careNav.hidden = !user;
      document.body.classList.toggle('has-real-account', Boolean(user));
    } catch { accountNav.hidden = true; careNav.hidden = true; document.body.classList.remove('has-real-account'); }
  }
  async function sitterOffersManager(application) {
    open(`<div class="eyebrow">MI OFERTA</div><h2 id="dialog-title">Servicios y precios</h2>
      <p class="fine">Podés ofrecer hasta un servicio por categoría. Los cambios se ven cuando PetCity aprueba tu perfil.</p>
      <form id="multi-offer-form" class="account-form">
        ${['paseo','cuidado_en_casa','alojamiento','vacaciones'].map(s=>`<label>${esc(serviceLabels[s])} — precio ARS<input name="${s}" type="number" min="0" placeholder="Sin ofrecer"></label>`).join('')}
        <button class="primary">Guardar servicios</button>
      </form><p id="account-status" role="status"></p><button class="secondary" id="back-account">Volver</button>`);
    document.querySelector('#back-account').onclick=dashboard;
    document.querySelector('#multi-offer-form').onsubmit=async ev=>{
      ev.preventDefault();const api=getClient();const f=new FormData(ev.target);
      for (const s of ['paseo','cuidado_en_casa','alojamiento','vacaciones']) {
        const price=Number(f.get(s));if(!price) continue;
        const {error}=await api.rpc('petcity_upsert_sitter_offer',{p_service:s,p_price_ars:price});
        if(error){status(error.message);return;}
      }
      status('Servicios guardados.');refreshRealOffers();
    };
  }
  async function sitterAvailabilityForm(application) {
    open(`<div class="eyebrow">AGENDA</div><h2 id="dialog-title">Disponibilidad semanal</h2>
      <p class="fine">Indicá cuántos servicios podés por día (0 = no disponible).</p>
      <form id="avail-form" class="account-form">
        ${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map((label,i)=>`<label>${label}<input name="d${i}" type="number" min="0" max="10" value="1"></label>`).join('')}
        <label>Fecha bloqueada (opcional)<input name="blackout" type="date"></label>
        <button class="primary">Guardar agenda</button>
      </form><p id="account-status" role="status"></p><button class="secondary" id="back-account">Volver</button>`);
    document.querySelector('#back-account').onclick=dashboard;
    document.querySelector('#avail-form').onsubmit=async ev=>{
      ev.preventDefault();const api=getClient();
      const fd=new FormData(ev.target);
      for (let i=0;i<7;i++){const cap=Number(fd.get(`d${i}`));if(cap>0)await api.from('sitter_availability_rules').upsert({application_id:application.id,weekday:i,capacity:cap},{onConflict:'application_id,weekday'});else await api.from('sitter_availability_rules').delete().eq('application_id',application.id).eq('weekday',i);}
      const bo=String(new FormData(ev.target).get('blackout'));if(bo)await api.from('sitter_availability_blackouts').upsert({application_id:application.id,blackout_date:bo});
      status('Agenda actualizada.');
    };
  }
  function sitterSetMapLocation(application) {
    if (!application || application.status !== 'approved') return;
    const save = async (lat, lng) => {
      const { error } = await getClient().rpc('petcity_update_sitter_location', { p_lat: lat, p_lng: lng });
      if (error) status(error.message);
      else {
        status('Ubicación guardada. Dueños verán tu zona aproximada en el mapa.');
        refreshRealOffers();
        dashboard();
      }
    };
    if (!navigator.geolocation) {
      status('Tu navegador no soporta geolocalización. Usá Chrome o Edge en el celular o PC.');
      return;
    }
    status('Obteniendo ubicación…');
    navigator.geolocation.getCurrentPosition(
      pos => save(pos.coords.latitude, pos.coords.longitude),
      () => status('No pudimos leer la ubicación. Revisá permisos del navegador e intentá de nuevo.'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }
  async function sitterPhotoUpload(application) {
    open(`<div class="eyebrow">FOTOS</div><h2 id="dialog-title">Fotos de tu servicio</h2>
      <form id="offer-photo-form" class="account-form"><label>Foto<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required></label><button class="primary">Enviar a revisión</button></form>
      <p class="fine">Las fotos se publican cuando PetCity las aprueba.</p><p id="account-status" role="status"></p><button class="secondary" id="back-account">Volver</button>`);
    document.querySelector('#back-account').onclick=dashboard;
    document.querySelector('#offer-photo-form').onsubmit=async ev=>{
      ev.preventDefault();try{const path=await uploadPhoto(new FormData(ev.target).get('photo'),'offer-photos');
      const {error}=await getClient().from('sitter_offer_photos').insert({application_id:application.id,photo_path:path});
      if(error)throw error;status('Foto enviada a moderación.');}catch(e){status(e.message);}
    };
  }
  async function publicSitterProfile(offerId) {
    const { data, error } = await getClient().rpc('petcity_public_sitter_profile', { chosen_offer: offerId });
    if (error) { open(`<h2 id="dialog-title">Perfil</h2><p>${esc(error.message)}</p>`); return; }
    const p = data;
    const photos = Array.isArray(p.photos) ? p.photos : [];
    const offerMeta = realOffers.find(o => o.id === offerId);
    const portraitPlaceholder = sitterCardPhotoPlaceholder(p.public_name);
    const homeLabels = { casa: 'Casa', depto: 'Departamento', finca: 'Finca con patio' };
    const detailChips = [
      p.neighborhood ? esc(p.neighborhood) : null,
      p.max_pets ? `Hasta ${p.max_pets} mascota${p.max_pets > 1 ? 's' : ''}` : null,
      p.home_type ? homeLabels[p.home_type] || esc(p.home_type) : null,
      p.accepts_cats === false ? 'Solo perros' : null,
      p.accepts_large_dogs === false ? 'Sin perros grandes' : null,
    ].filter(Boolean);
    const ratingHtml = p.rating_count
      ? `<p class="spp-rating"><b>★ ${esc(String(p.rating_avg))}</b> · ${p.rating_count} reseña${p.rating_count === 1 ? '' : 's'} verificada${p.rating_count === 1 ? '' : 's'}</p>`
      : '<p class="spp-rating spp-rating-new"><b>★</b> Nuevo en PetCity</p>';
    open(`<article class="sitter-public-profile">
      <header class="spp-header">
        <img class="spp-portrait" id="spp-portrait" src="${esc(portraitPlaceholder)}" alt="Foto de ${esc(p.public_name)}" width="120" height="120">
        <div class="spp-head-text">
          <span class="badge-verified">Verificado por PetCity</span>
          <h2 id="dialog-title">${esc(p.public_name)}</h2>
          <p class="spp-meta"><span class="spp-service-icon" aria-hidden="true">${serviceIcon(p.service)}</span> ${esc(serviceLabels[p.service] || p.service)} · ⌖ ${esc(p.city)}</p>
          ${ratingHtml}
        </div>
        <div class="spp-price-block">
          <span class="spp-price">$${Number(p.price_ars).toLocaleString('es-AR')}</span>
          <span class="spp-unit">/ ${esc(p.unit)}</span>
        </div>
      </header>
      ${p.headline ? `<p class="spp-headline">${esc(p.headline)}</p>` : ''}
      <section class="spp-section">
        <h3 class="spp-section-title">Sobre el cuidador</h3>
        <p class="spp-bio">${esc(p.bio)}</p>
        ${detailChips.length ? `<ul class="spp-chips">${detailChips.map(c => `<li>${c}</li>`).join('')}</ul>` : ''}
      </section>
      <section class="spp-section">
        <h3 class="spp-section-title">Fotos del servicio</h3>
        <div class="spp-gallery" id="profile-photos">${photos.length ? '<p class="fine">Cargando fotos…</p>' : '<p class="spp-empty">El cuidador aún no tiene fotos aprobadas.</p>'}</div>
      </section>
      <footer class="spp-footer">
        <button type="button" class="primary" id="book-from-profile">Solicitar cuidado</button>
      </footer>
      <p class="fine spp-note">Reseñas y fotos provienen de servicios completados y moderados en PetCity.</p>
    </article>`);
    document.querySelector('#book-from-profile').onclick = () => realBooking(offerMeta || realOffers.find(o => o.id === offerId) || { id: offerId, ...p });
    const portraitEl = document.querySelector('#spp-portrait');
    const photoPath = offerMeta?.photo_path || photos[0]?.path;
    if (photoPath && portraitEl) {
      const url = await signedPhoto(photoPath);
      if (url) portraitEl.src = url;
    }
    const gallery = document.querySelector('#profile-photos');
    if (photos.length && gallery) {
      gallery.innerHTML = '';
      for (const ph of photos) {
        const url = await signedPhoto(ph.path);
        if (url) gallery.insertAdjacentHTML('beforeend', `<img src="${esc(url)}" alt="" loading="lazy">`);
      }
    }
  }
  function initWalkTracking(booking, userId, isSitter, isWalk) {
    if (!isWalk || !window.L) return;
    const mapEl = document.querySelector('#walk-map');
    if (!mapEl) return;
    const map = L.map(mapEl, { scrollWheelZoom: false }).setView([-34.587, -58.43], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OSM' }).addTo(map);
    const routeLayer = L.layerGroup().addTo(map);
    let headMarker = null;
    let watchId = null;
    const statsEl = document.querySelector('#walk-track-stats');
    const draw = async () => {
      const { data, error } = await getClient().from('walk_track_points')
        .select('lat,lng,recorded_at').eq('booking_id', booking.id).order('recorded_at', { ascending: true });
      if (error || !data?.length) {
        if (statsEl && !error) statsEl.textContent = 'Todavía no hay puntos en el recorrido.';
        return;
      }
      routeLayer.clearLayers();
      const latlngs = data.map(p => [p.lat, p.lng]);
      L.polyline(latlngs, { color: '#176b60', weight: 5, opacity: 0.9 }).addTo(routeLayer);
      const last = latlngs[latlngs.length - 1];
      if (headMarker) headMarker.remove();
      headMarker = L.circleMarker(last, { radius: 9, color: '#fff', weight: 2, fillColor: '#173e3a', fillOpacity: 1 }).addTo(map);
      map.fitBounds(latlngs, { padding: [28, 28], maxZoom: 16 });
      if (statsEl) {
        statsEl.textContent = `${data.length} punto${data.length === 1 ? '' : 's'} · último ${new Date(data[data.length - 1].recorded_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
      }
      setTimeout(() => map.invalidateSize(), 120);
    };
    draw();
    const poll = setInterval(draw, 5000);
    const startBtn = document.querySelector('#walk-start');
    const stopBtn = document.querySelector('#walk-stop');
    startBtn?.addEventListener('click', () => {
      if (!isSitter) return;
      if (!navigator.geolocation) { status('Tu navegador no soporta geolocalización.'); return; }
      if (watchId != null) return;
      watchId = navigator.geolocation.watchPosition(async pos => {
        await getClient().rpc('petcity_record_walk_point', {
          chosen_booking: booking.id,
          p_lat: pos.coords.latitude,
          p_lng: pos.coords.longitude,
        });
        draw();
      }, () => status('No pudimos acceder a la ubicación. Revisá permisos.'), { enableHighAccuracy: true, maximumAge: 8000, timeout: 20000 });
      startBtn.hidden = true;
      if (stopBtn) stopBtn.hidden = false;
      status('Compartiendo ubicación del paseo…');
    });
    stopBtn?.addEventListener('click', () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      watchId = null;
      if (startBtn) startBtn.hidden = false;
      stopBtn.hidden = true;
      status('Dejaste de compartir ubicación.');
    });
    setServiceMessageTimer(setInterval(() => {
      if (!document.querySelector('#walk-map')?.isConnected) {
        clearServiceMessageTimer();
        clearInterval(poll);
        if (watchId != null) navigator.geolocation.clearWatch(watchId);
      }
    }, 3000));
  }
  let shopCartId = null;
  async function refreshShopCart() {
    const body = document.getElementById('shop-cart-body');
    if (!body) return;
    if (!shopCartId) {
      body.innerHTML = '<p class="fine">Ingresá para guardar tu carrito.</p><button type="button" class="primary" id="shop-login">Ingresar</button>';
      body.querySelector('#shop-login')?.addEventListener('click', login);
      return;
    }
    const { data: items } = await getClient().from('shop_order_items').select('quantity,unit_price_ars,shop_products(name)').eq('order_id', shopCartId);
    const total = (items || []).reduce((s, i) => s + i.quantity * i.unit_price_ars, 0);
    body.innerHTML = items?.length
      ? `<ul class="shop-cart-list">${items.map(i => `<li><span>${esc(i.shop_products.name)}</span><span>× ${i.quantity}</span><strong>$${(i.quantity * i.unit_price_ars).toLocaleString('es-AR')}</strong></li>`).join('')}</ul><div class="shop-cart-total"><span>Total</span><strong>$${total.toLocaleString('es-AR')}</strong></div><button type="button" class="primary shop-checkout-btn" id="shop-checkout">Confirmar pedido</button><p class="fine">El pedido queda en estado pendiente de pago. Te contactamos para coordinar envío.</p>`
      : '<p class="fine">Tu carrito está vacío.</p>';
    body.querySelector('#shop-checkout')?.addEventListener('click', shopCheckout);
    const btn = document.getElementById('shop-cart-btn');
    if (btn) btn.textContent = `Carrito (${(items || []).reduce((s, i) => s + i.quantity, 0)})`;
  }
  async function shopCheckout() {
    const api = getClient();
    const { data: { user } } = await api.auth.getUser();
    if (!user) return login();
    const button = document.querySelector('#shop-checkout');
    if (button) button.disabled = true;
    const { data: newCartId, error } = await api.rpc('petcity_submit_shop_cart');
    if (error) {
      status(error.message);
      if (button) button.disabled = false;
      return;
    }
    shopCartId = newCartId;
    status('Pedido registrado. Revisá tu email o Mis datos para el seguimiento.');
    await refreshShopCart();
    await shopPage();
  }
  let shopBusy = false;
  async function shopPage() {
    if (shopBusy) return;
    shopBusy = true;
    const api = getClient();
    const { data: { user } } = await api.auth.getUser();
    const catalog = document.getElementById('shop-catalog');
    if (!catalog) { shopBusy = false; return; }
    catalog.innerHTML = '<p class="fine">Cargando productos…</p>';
    const { data: products, error } = await api.from('shop_products').select('*').eq('active', true).order('name');
    if (error) { catalog.innerHTML = `<p class="fine">${esc(error.message)}</p>`; shopBusy = false; return; }
    catalog.innerHTML = (products || []).map(p => `<article class="shop-product-card" role="listitem"><div class="shop-product-art" aria-hidden="true">🛍</div><div class="shop-product-body"><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><div class="shop-product-foot"><strong>$${Number(p.price_ars).toLocaleString('es-AR')}</strong><span class="fine">${p.stock} en stock</span><button type="button" class="primary" data-add-product="${esc(p.id)}" data-price="${p.price_ars}">Agregar</button></div></div></article>`).join('');
    if (user) {
      const { data: cartId } = await api.rpc('petcity_get_or_create_cart');
      shopCartId = cartId;
    } else shopCartId = null;
    await refreshShopCart();
    const cartBtn = document.getElementById('shop-cart-btn');
    if (cartBtn) cartBtn.onclick = () => document.getElementById('shop-cart-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    catalog.querySelectorAll('[data-add-product]').forEach(btn => btn.onclick = async () => {
      if (!user) return login();
      const { error: err } = await api.from('shop_order_items').upsert({ order_id: shopCartId, product_id: btn.dataset.addProduct, quantity: 1, unit_price_ars: Number(btn.dataset.price) }, { onConflict: 'order_id,product_id' });
      if (err) status(err.message);
      else { status('Agregado al carrito.'); refreshShopCart(); }
    });
    shopBusy = false;
  }
  let realMapPending;
  async function renderRealMap() {
    const layer = window.petcityRealOffersLayer;
    const map = window.petcityCityMap;
    const L = window.L;
    if (!layer || !map || !L) {
      if (!realMapPending) {
        realMapPending = true;
        window.addEventListener('petcity-map-ready', () => { realMapPending = false; renderRealMap(); }, { once: true });
        setTimeout(() => { if (realMapPending) { realMapPending = false; renderRealMap(); } }, 800);
      }
      return;
    }
    layer.clearLayers();
    const { data, error } = await getClient().rpc('petcity_list_approved_offers_map');
    if (error || !data?.length) return;
    const offersById = Object.fromEntries(realOffers.map(o => [o.id, o]));
    for (const row of data) {
      if (row.lat == null || row.lng == null) continue;
      const meta = offersById[row.offer_id] || {};
      const icon = createMapPinIcon(L, {
        serviceKey: row.service,
        price: row.price_ars,
        active: false,
      });
      if (!icon) continue;
      const pos = [row.lat, row.lng];
      const label = esc(row.public_name || meta.public_name || 'Cuidador');
      L.marker(pos, { icon, title: label }).addTo(layer)
        .bindPopup(`<strong>${label}</strong><br>${esc(serviceLabels[row.service] || row.service)} · ${esc(formatMapPrice(row.price_ars))}`)
        .on('click', () => publicSitterProfile(row.offer_id));
    }
    setTimeout(() => map.invalidateSize(), 50);
  }
  const demoMode=new URLSearchParams(location.search).has('demo');
  if(demoMode)document.body.classList.add('demo-mode');
  let realOffers=[];
  let searchedPlace='';
  const REAL_SAVED_KEY = 'petcity-saved-offers';
  const realSavedOffers = new Set(JSON.parse(localStorage.getItem(REAL_SAVED_KEY) || '[]'));
  function persistRealSaved() {
    localStorage.setItem(REAL_SAVED_KEY, JSON.stringify([...realSavedOffers]));
    window.petcityDemoRender?.();
  }
  window.petcityBuildLeafletMapPin = opts => createMapPinIcon(window.L, opts);
  window.petcityRealSavedCount = () => realSavedOffers.size;
  const offersSection=document.createElement('div');
  offersSection.id='real-offers';
  offersSection.hidden=true;
  offersSection.className='real-offers-block';
  const cardsEl=document.querySelector('#guest-main .content #cards');
  if(cardsEl?.parentElement)cardsEl.parentElement.insertBefore(offersSection,cardsEl);
  function sitterCardPhotoPlaceholder(name) {
    const label = encodeURIComponent(String(name || 'Cuidador').trim().slice(0, 24));
    return `https://ui-avatars.com/api/?name=${label}&background=c7f3e8&color=173e3a&size=280&bold=true`;
  }
  async function hydrateRealOfferPortraits(root) {
    await Promise.all([...root.querySelectorAll('img.portrait[data-photo-path]')].map(async img => {
      const path = img.dataset.photoPath;
      if (!path) return;
      const url = await signedPhoto(path);
      if (url) img.src = url;
    }));
  }
  function formatCardRating(o) {
    const count = Number(o.rating_count) || 0;
    if (!count) return '<span class="card-rating card-rating-new"><b>★</b> Nuevo</span>';
    const avg = o.rating_avg != null ? esc(String(o.rating_avg)) : '—';
    return `<span class="card-rating"><b>★</b> ${avg} <span class="muted">(${count})</span></span>`;
  }
  async function attachSitterRatings(offers) {
    const firstOfferByApp = new Map();
    for (const o of offers) {
      if (o.application_id && !firstOfferByApp.has(o.application_id)) firstOfferByApp.set(o.application_id, o.id);
    }
    const ratings = {};
    await Promise.all([...firstOfferByApp.entries()].map(async ([appId, offerId]) => {
      try {
        const { data } = await getClient().rpc('petcity_public_sitter_profile', { chosen_offer: offerId });
        if (data) ratings[appId] = { rating_avg: data.rating_avg, rating_count: data.rating_count };
      } catch { /* perfil no disponible */ }
    }));
    return offers.map(o => ({
      ...o,
      rating_avg: ratings[o.application_id]?.rating_avg ?? o.rating_avg,
      rating_count: ratings[o.application_id]?.rating_count ?? o.rating_count,
    }));
  }
  function renderRealOffers() {
    if (!realOffers.length) return;
    const category=document.querySelector('.chip.active')?.dataset.category || 'Todos';
    const savedOnly = document.querySelector('#saved-toggle')?.getAttribute('aria-pressed') === 'true';
    const shown=realOffers.filter(o=>(category==='Todos'||serviceLabels[o.service]===category)&&(!searchedPlace||o.city.toLowerCase().includes(searchedPlace))&&(!savedOnly||realSavedOffers.has(o.id)));
    const serviceLabel = o => esc(serviceLabels[o.service] || o.service);
    offersSection.innerHTML=`<div class="results-head results-head-compact"><div class="eyebrow">Verificados por PetCity</div><h3 class="real-offers-title">${shown.length} cuidador${shown.length===1?'':'es'} real${shown.length===1?'':'es'}</h3></div>
      <div class="cards real-offer-cards">${shown.length ? shown.map(o => `<article class="card card-sitter-real">
        <img class="portrait" src="${esc(sitterCardPhotoPlaceholder(o.public_name))}" alt="Foto de ${esc(o.public_name)}" width="126" height="142" loading="lazy"${o.photo_path ? ` data-photo-path="${esc(o.photo_path)}"` : ''}>
        <div class="cardbody">
          <div class="card-sitter-head">
            <span class="badge-verified">Verificado</span>
            <div class="card-sitter-tools">
              ${formatCardRating(o)}
              <button type="button" class="save-heart${realSavedOffers.has(o.id) ? ' is-saved' : ''}" data-save-offer="${esc(o.id)}" aria-label="${realSavedOffers.has(o.id) ? 'Quitar de guardados' : 'Guardar cuidador'}" aria-pressed="${realSavedOffers.has(o.id)}"><span aria-hidden="true">${realSavedOffers.has(o.id) ? '♥' : '♡'}</span></button>
            </div>
          </div>
          <div class="cardrow"><span class="name">${esc(o.public_name)}</span></div>
          <div class="muted">⌖ ${esc(o.city)} · ${serviceLabel(o)}</div>
          ${o.bio ? `<div class="card-bio-wrap"><p class="description card-bio-text">${esc(o.bio)}</p><button type="button" class="card-read-more" data-view-offer="${esc(o.id)}">Leer más</button></div>` : ''}
          <div class="tags"><span class="tag">${serviceLabel(o)}</span></div>
          <div class="cardfoot cardfoot-verified">
            <div class="cardfoot-price-col">
              <span class="price price-verified">$${Number(o.price_ars).toLocaleString('es-AR')} <small>/ ${esc(o.unit)}</small></span>
              <div class="cardfoot-actions-row">
                <button type="button" class="secondary" data-view-offer="${esc(o.id)}">Ver perfil</button>
                <button type="button" class="primary" data-real-offer="${esc(o.id)}">Solicitar cuidado</button>
              </div>
            </div>
          </div>
        </div>
      </article>`).join('') : '<p class="empty-state">No hay ofertas aprobadas con esos filtros.</p>'}</div>
      <p class="fine">${isPaymentsEnabled()?'Podés pagar con Mercado Pago (sandbox) tras la aceptación del cuidador.':'La solicitud no incluye pago hasta habilitar Mercado Pago.'} Requiere migraciones 006+ en Supabase.</p>`;
    offersSection.querySelectorAll('[data-real-offer]').forEach(button=>button.onclick=()=>realBooking(realOffers.find(o=>o.id===button.dataset.realOffer)));
    offersSection.querySelectorAll('[data-view-offer]').forEach(button=>button.onclick=()=>publicSitterProfile(button.dataset.viewOffer));
    offersSection.querySelectorAll('[data-save-offer]').forEach(button => {
      button.onclick = event => {
        event.stopPropagation();
        const id = button.dataset.saveOffer;
        if (realSavedOffers.has(id)) realSavedOffers.delete(id);
        else realSavedOffers.add(id);
        persistRealSaved();
        renderRealOffers();
      };
    });
    hydrateRealOfferPortraits(offersSection);
  }
  async function refreshRealOffers() {
    try {
      const {data,error}=await getClient().from('sitter_applications')
        .select('id,public_name,city,bio,headline,sitter_offers(id,service,price_ars,unit),sitter_offer_photos(photo_path,sort_order,status)')
        .eq('status','approved');
      if(error) return;
      realOffers=(data||[]).flatMap(a=>{
        const photo_path=(a.sitter_offer_photos||[])
          .filter(p=>p.status==='approved')
          .sort((x,y)=>x.sort_order-y.sort_order)[0]?.photo_path||null;
        return (a.sitter_offers||[]).map(o=>({...o,application_id:a.id,public_name:a.public_name,city:a.city,bio:a.bio,headline:a.headline,photo_path}));
      });
      realOffers = await attachSitterRatings(realOffers);
      offersSection.hidden=!realOffers.length;
      if(realOffers.length){renderRealOffers();renderRealMap();}
      else if(window.petcityRealOffersLayer)window.petcityRealOffersLayer.clearLayers();
    } catch(error) { console.error('PetCity approved offers:',error); }
  }
  async function realBooking(offer) {
    if(!offer) return;
    const api=getClient(),{data:{user}}=await api.auth.getUser();
    if(!user) return login();
    const {data:pets,error}=await api.from('pets').select('id,name').order('created_at',{ascending:false});
    if(error) {open(`<h2 id="dialog-title">Solicitar cuidado</h2><p>${esc(error.message)}</p>`);return;}
    if(!pets.length) {open('<h2 id="dialog-title">Primero agregá tu mascota</h2><p>Su ficha es necesaria para solicitar un cuidado.</p><button class="primary" id="go-pet">Agregar mascota</button>');document.querySelector('#go-pet').onclick=petForm;return;}
    const overnight=['alojamiento','vacaciones'].includes(offer.service);
    const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'});
    open(`<div class="eyebrow">SOLICITUD REAL · SIN PAGO</div><h2 id="dialog-title">${esc(offer.public_name)}</h2>
      <p>${esc(serviceLabels[offer.service])} · $${Number(offer.price_ars).toLocaleString('es-AR')} / ${esc(offer.unit)}</p>
      <form id="real-booking-form" class="account-form"><label>Tu mascota<select name="pet">${pets.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label>
      <label>${overnight?'Check-in':'Fecha'}<input name="start" type="date" min="${today}" required></label>
      ${overnight?`<label>Check-out<input name="end" type="date" min="${today}" required></label>`:''}
      <button class="primary">Enviar solicitud</button></form><p id="account-status" role="status" aria-live="polite"></p>`);
    document.querySelector('#real-booking-form').onsubmit=async event=>{
      event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;
      const form=new FormData(event.target),start=String(form.get('start')),end=overnight?String(form.get('end')):start;
      const {error:requestError}=await api.rpc('petcity_request_booking',{chosen_offer:offer.id,chosen_pet:form.get('pet'),requested_start:start,requested_end:end});
      if(requestError){status(requestError.message);button.disabled=false;}else {
        open(`<div class="eyebrow">SOLICITUD ENVIADA</div><h2 id="dialog-title">Esperando respuesta del cuidador</h2>
          <p>El cuidador la verá en <strong>Mis cuidados</strong>. Todavía no se realizó ningún pago.</p>
          <button type="button" class="primary" id="go-account">Ir a Mis cuidados</button>`);
        document.querySelector('#go-account').onclick=openServicesHub;
      }
    };
  }
  document.querySelector('#shop-nav')?.addEventListener('click', ev => {
    ev.stopImmediatePropagation();
    ev.preventDefault();
    setView('shop');
  }, true);
  document.querySelectorAll('.chip').forEach(button=>button.addEventListener('click',()=>setTimeout(renderRealOffers,0)));
  document.querySelector('#saved-toggle')?.addEventListener('click', () => setTimeout(renderRealOffers, 0));
  document.querySelector('#search')?.addEventListener('submit', event => {
    if (realOffers.length) {
      event.preventDefault();
      event.stopImmediatePropagation();
      searchedPlace = document.querySelector('#place').value.trim().split(',')[0].toLowerCase();
      renderRealOffers();
    }
  }, true);
  fetch('/api/config/payments').then(r => (r.ok ? r.json() : {})).then(j => {
    if (j?.enabled) window.PETCITY_PAYMENTS = true;
  }).catch(() => {});
  refreshRealOffers();
  window.petcityDemoRender?.();
  if (location.hash.includes('comunidad') || new URLSearchParams(location.search).has('post')) setTimeout(() => { setView('community', false); community(); }, 300);
  syncViewFromHash();
  bindLoginNav();
  const hashSlug = (location.hash || '').replace(/^#\/?/, '').split('/')[0].toLowerCase();
  if (hashSlug === 'cuenta') void ensureAccountScreen();
  window.addEventListener('hashchange', () => {
    if ((location.hash || '').replace(/^#\/?/, '').split('/')[0].toLowerCase() === 'cuenta') {
      void ensureAccountScreen();
    }
  });
  window.dispatchEvent(new Event('petcity-ready'));
  document.querySelector('#become')?.addEventListener('click', event => {
    getClient().auth.getUser().then(({ data }) => {
      if (data.user) {
        event.stopImmediatePropagation();
        accountTab = 'sitter';
        setTimeout(accountHome, 0);
      }
    }).catch(() => {});
  }, true);
  try {
    getClient().auth.onAuthStateChange((event, session) => {
      setTimeout(syncNav, 0);
      if (event === 'PASSWORD_RECOVERY' && session) {
        open(`<div class="eyebrow">CUENTA PETCITY</div><h2 id="dialog-title">Nueva contraseña</h2>
          <form id="new-password-form" class="account-form"><label>Nueva contraseña<input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
          <button class="primary">Guardar contraseña</button></form><p id="account-status" role="status"></p>`);
        document.querySelector('#new-password-form').onsubmit = async ev => {
          ev.preventDefault();
          const password = String(new FormData(ev.target).get('password'));
          const { error } = await getClient().auth.updateUser({ password });
          if (error) status(error.message);
          else { status('Contraseña actualizada.'); history.replaceState(null, '', location.pathname); dashboard(); }
        };
      }
    });
    syncNav();
  } catch (error) { console.error('PetCity account:', error); }
  const returningFromEmail = location.hash.includes('access_token=') || location.search.includes('type=recovery') || new URLSearchParams(location.search).has('code');
  if (returningFromEmail) {
    try {
      getClient().auth.getSession().then(({ data: { session } }) => {
        if (session) {
          const cleanedSearch = location.search.replace(/([?&])code=[^&]+&?/, '$1').replace(/[?&]$/, '');
          history.replaceState(null, '', location.pathname + (cleanedSearch === '?' ? '' : cleanedSearch));
          if (location.hash.includes('type=recovery')) return;
          setTimeout(dashboard, 0);
        }
      });
    } catch (error) { console.error('PetCity auth callback:', error); }
  }
}
