/* PetCity first production slice: identity, private pet records and moderated offers. */
(() => {
  const projectUrl = 'https://ifvfadgcyevmsklotrql.supabase.co';
  const publishableKey = 'sb_publishable_5Y2umR15QdQZ5GzreS0sog_CGFsglFX';
  let client;
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
  document.querySelector('#login-nav').before(accountNav);
  accountNav.before(careNav);
  careNav.before(communityNav);
  communityNav.onclick=community;
  accountNav.onclick = () => { accountTab = 'pets'; accountHome(); };
  careNav.onclick = () => { accountTab = 'services'; accountHome(); };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const modal = document.querySelector('#modal-content');
  let serviceMessageTimer;
  const communityStyle=document.createElement('style');
  communityStyle.textContent=`.modal.community-wide{width:min(1240px,calc(100vw - 28px))}.community-head{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px}.community-head h2{margin:3px 0}.community-head .primary{width:auto}.community-grid{columns:4 190px;column-gap:14px}.community-card{break-inside:avoid;border:1px solid #e3eae1;border-radius:18px;overflow:hidden;background:#fff;margin:0 0 14px;box-shadow:0 6px 24px rgba(22,49,39,.06)}.community-photo{min-height:140px;background:#e9f0e8;display:grid;place-items:center;color:#527163}.community-photo img{display:block;width:100%;height:auto}.community-copy{padding:13px}.community-copy p{margin:5px 0 10px;white-space:pre-wrap}.community-meta{font-size:12px;color:#60756a}.community-example{display:inline-block;background:#eaf2e3;color:#245142;border-radius:50px;padding:4px 8px;font-size:12px;font-weight:800;margin-bottom:6px}.community-actions{display:flex;gap:7px;flex-wrap:wrap}.community-actions button{padding:7px 10px;font-size:13px}.community-comment{border-left:2px solid #dfe7df;padding-left:9px;font-size:13px}.community-composer{background:#f4f8f2;border-radius:16px;padding:16px;margin:0 0 18px}.community-composer[hidden]{display:none}@media(max-width:600px){.community-grid{columns:2 145px;column-gap:9px}.community-card{margin-bottom:9px}.community-copy{padding:10px}.community-head .primary{width:100%}}`;
  document.head.append(communityStyle);
  const status = message => { const node = document.querySelector('#account-status'); if (node) node.textContent = message; };
  const open = html => {
    clearInterval(serviceMessageTimer);
    document.querySelector('.modal').classList.add('wide');
    document.querySelector('.modal').classList.remove('community-wide');
    modal.innerHTML = html;
    document.querySelector('#overlay').classList.add('open');
  };
  function getClient() {
    if (!window.supabase?.createClient) throw new Error('No se pudo cargar la conexión. Reintentá en unos segundos.');
    return client ??= window.supabase.createClient(projectUrl, publishableKey);
  }
  const login = (mode = 'signin') => {
    open(`<div class="eyebrow">CUENTA PETCITY</div><h2 id="dialog-title">${mode === 'signup' ? 'Crear cuenta' : 'Ingresar a tu cuenta'}</h2>
      <p>Tus mascotas y postulaciones quedarán guardadas en tu cuenta.</p>
      <form id="account-form" class="account-form">
        ${mode === 'signup' ? '<label>Nombre<input name="name" required maxlength="100" autocomplete="name"></label>' : ''}
        <label>Email<input name="email" type="email" required autocomplete="email"></label>
        <label>Contraseña<input name="password" type="password" required minlength="8" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}"></label>
        <button class="primary" type="submit">${mode === 'signup' ? 'Crear cuenta' : 'Ingresar'}</button>
      </form><button class="secondary" id="switch-account" style="margin-top:12px">${mode === 'signup' ? 'Ya tengo cuenta' : 'Crear una cuenta'}</button>
      ${mode === 'signin' ? '<button type="button" class="secondary" id="forgot-password" style="margin-top:8px">Olvidé mi contraseña</button>' : ''}
      <p id="account-status" role="status" aria-live="polite"></p>`);
    document.querySelector('#switch-account').onclick = () => login(mode === 'signup' ? 'signin' : 'signup');
    document.querySelector('#forgot-password')?.addEventListener('click', async () => {
      const email = String(document.querySelector('#account-form input[name=email]')?.value || '').trim();
      if (!email) { status('Ingresá tu email para recibir el enlace de recuperación.'); return; }
      status('Enviando enlace…');
      try {
        const { error } = await getClient().auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/' });
        if (error) throw error;
        status('Revisá tu email. El enlace vuelve a PetCity para elegir una contraseña nueva.');
      } catch (error) { status(error.message || 'No pudimos enviar el enlace.'); }
    });
    document.querySelector('#account-form').onsubmit = async event => {
      event.preventDefault();
      const button = event.target.querySelector('button[type=submit]');
      button.disabled = true;
      status('Conectando…');
      try {
        const form = new FormData(event.target);
        const email = String(form.get('email')).trim();
        const password = String(form.get('password'));
        const result = mode === 'signup'
          ? await getClient().auth.signUp({ email, password, options: { data: { full_name: String(form.get('name')).trim() }, emailRedirectTo: location.origin + '/' } })
          : await getClient().auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        if (result.data.session) await dashboard();
        else status(mode === 'signup'
          ? 'Te enviamos un email de confirmación. Abrilo desde este dispositivo y volvé a ingresar.'
          : 'Si tu cuenta no está confirmada, revisá el email de PetCity o pedí un enlace nuevo desde registro.');
      } catch (error) {
        const msg = error.message || 'No se pudo completar el acceso.';
        status(/invalid login credentials/i.test(msg)
          ? 'Email o contraseña incorrectos. Si acabás de registrarte, confirmá el email antes de ingresar.'
          : msg);
      }
      finally { button.disabled = false; }
    };
  };
  async function accountHome() {
    try {
      const { data, error } = await getClient().auth.getUser();
      if (error || !data.user) return login();
      await dashboard();
    } catch (error) { open(`<h2 id="dialog-title">Cuenta PetCity</h2><p>${esc(error.message)}</p>`); }
  }
  async function dashboard() {
    try {
      const api = getClient();
      const { data: auth } = await api.auth.getUser();
      if (!auth.user) return login();
      const [{data: profile, error: profileError}, {data: pets, error: petsError}, {data: application, error: applicationError}, {data: isAdmin, error: adminError}, {data: bookings, error: bookingsError}] = await Promise.all([
        api.from('profiles').select('*').eq('id', auth.user.id).single(),
        api.from('pets').select('*').order('created_at', {ascending:false}),
        api.from('sitter_applications').select('*').eq('user_id',auth.user.id).maybeSingle(),
        api.rpc('petcity_is_admin'),
        api.from('bookings').select('id,owner_id,pet_id,offer_id,start_date,end_date,total_price_ars,status').order('created_at',{ascending:false}).limit(20)
      ]);
      if (profileError || petsError || applicationError || adminError) throw profileError || petsError || applicationError || adminError;
      enhancedReady = Object.hasOwn(profile,'phone');
      marketplaceReady = !bookingsError;
      const bookingList = bookings || [];
      const tabs = [['pets','Mis mascotas'],['services','Mis cuidados'],['personal','Mis datos'],['sitter','Quiero cuidar'],['community','Comunidad']];
      const nav = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:18px 0">${tabs.map(([key,label])=>`<button class="${accountTab===key?'primary':'secondary'}" data-account-tab="${key}">${label}</button>`).join('')}</div>`;
      const petCards = pets.length ? pets.map(p=>`<div class="dash-tile" style="margin:10px 0"><div style="display:flex;align-items:center;gap:16px"><span data-pet-photo="${esc(p.photo_path||'')}" style="width:72px;height:72px;border-radius:18px;background:#e8f1e9;display:grid;place-items:center;overflow:hidden">🐾</span><div><h3>${esc(p.name)}</h3><p>${esc(p.species)}${p.breed?' · '+esc(p.breed):''}${p.size?' · '+esc(p.size):''}${p.weight_kg?' · '+esc(p.weight_kg)+' kg':''}</p></div></div><p>${esc(p.care_notes||'Sin indicaciones cargadas.')}</p><button class="dash-call" data-edit-pet="${esc(p.id)}">Ver y editar ficha</button></div>`).join('') : '<p>Todavía no cargaste mascotas.</p>';
      const serviceCards = bookingsError ? '<p>Estamos habilitando las solicitudes.</p>' : bookingList.length ? bookingList.map(b=>`<div class="dash-tile" style="margin:10px 0"><strong>${b.owner_id===auth.user.id?'Cuidado solicitado':'Cuidado recibido'} · ${esc(stateLabels[b.status] || b.status)}</strong><p>${esc(b.start_date)}${b.end_date!==b.start_date?' al '+esc(b.end_date):''} · $${Number(b.total_price_ars).toLocaleString('es-AR')}</p><button class="dash-call" data-service="${esc(b.id)}">Ver servicio y novedades</button>${b.owner_id!==auth.user.id&&b.status==='pending'?` <button class="dash-call" data-booking="${esc(b.id)}" data-decision="accepted">Aceptar</button> <button class="secondary" data-booking="${esc(b.id)}" data-decision="rejected">Rechazar</button>`:b.owner_id===auth.user.id&&b.status==='pending'?` <button class="secondary" data-booking="${esc(b.id)}" data-decision="cancelled">Cancelar solicitud</button>`:''}</div>`).join('') : '<p>Todavía no tenés servicios. Encontrá un cuidador en las ofertas aprobadas.</p>';
      const contents = {
        pets: `<h3>Mis mascotas</h3>${petCards}<button class="primary" id="add-real-pet">Agregar mascota</button>`,
        services: `<h3>Mis cuidados</h3><p>Acá aparecen tus solicitudes, horarios y novedades del cuidado.</p>${serviceCards}`,
        personal: `<h3>Mis datos</h3><form id="profile-form" class="account-form"><label>Nombre<input name="display_name" maxlength="100" required value="${esc(profile.display_name)}"></label><label>Email<input value="${esc(auth.user.email)}" disabled></label>${enhancedReady?`<label>Teléfono<input name="phone" type="tel" maxlength="40" value="${esc(profile.phone)}"></label><label>Dirección<input name="address" maxlength="200" autocomplete="street-address" value="${esc(profile.address)}"></label><label>Ciudad<input name="city" maxlength="100" autocomplete="address-level2" value="${esc(profile.city)}"></label>`:'<p>Teléfono y dirección se habilitarán con la próxima actualización.</p>'}<button class="primary">Guardar datos</button></form><p class="fine">Tu dirección y teléfono son privados.</p>`,
        sitter: `<h3>Quiero cuidar mascotas</h3><p>${application ? `Postulación: ${esc(stateLabels[application.status] || application.status)}${application.review_note ? ' · '+esc(application.review_note) : ''}` : 'Tu oferta necesita revisión antes de publicarse.'}</p><button class="dash-call" id="real-application">${application ? 'Ver postulación' : 'Empezar postulación'}</button>`,
        community: '<h3>Comunidad PetCity</h3><p>Fotos, historias y comentarios de dueños y cuidadores. Cada publicación se revisa antes de aparecer.</p><button class="primary" id="open-community">Explorar comunidad</button>'
      };
      open(`<div class="eyebrow">MI CUENTA</div><h2 id="dialog-title">Hola, ${esc(profile.display_name || auth.user.email)}</h2>${nav}<div>${contents[accountTab]||contents.pets}</div>${isAdmin ? '<p><button class="secondary" id="real-moderation">Revisar postulaciones y comunidad</button></p>' : ''}<p id="account-status" role="status" aria-live="polite"></p><button class="secondary" id="real-signout">Cerrar sesión</button>`);
      document.querySelectorAll('[data-account-tab]').forEach(button=>button.onclick=()=>{accountTab=button.dataset.accountTab;dashboard();});
      document.querySelector('#add-real-pet')?.addEventListener('click',petForm);
      document.querySelectorAll('[data-edit-pet]').forEach(button=>button.onclick=()=>petForm(pets.find(p=>p.id===button.dataset.editPet)));
      document.querySelectorAll('[data-pet-photo]').forEach(async node=>{if(node.dataset.petPhoto){const url=await signedPhoto(node.dataset.petPhoto);if(url)node.innerHTML=`<img src="${esc(url)}" alt="" style="width:100%;height:100%;object-fit:cover">`;}});
      document.querySelectorAll('[data-service]').forEach(button=>button.onclick=()=>serviceDetail(bookingList.find(b=>b.id===button.dataset.service),auth.user.id));
      document.querySelector('#profile-form')?.addEventListener('submit',async event=>{event.preventDefault();const form=new FormData(event.target);const changes={display_name:String(form.get('display_name')).trim()};if(enhancedReady)Object.assign(changes,{phone:String(form.get('phone')).trim(),address:String(form.get('address')).trim(),city:String(form.get('city')).trim()});const {error}=await api.from('profiles').update(changes).eq('id',auth.user.id);if(error)status(error.message);else dashboard();});
      document.querySelector('#real-application')?.addEventListener('click',()=>applicationForm(application));
      document.querySelector('#open-community')?.addEventListener('click',community);
      if (isAdmin) document.querySelector('#real-moderation').onclick = moderation;
      document.querySelectorAll('[data-booking]').forEach(button=>button.onclick=async()=>{
        button.disabled=true;
        const result=button.dataset.decision==='cancelled'
          ? await api.rpc('petcity_cancel_pending_booking',{chosen_booking:button.dataset.booking})
          : await api.rpc('petcity_decide_booking',{chosen_booking:button.dataset.booking,decision:button.dataset.decision});
        if(result.error){status(result.error.message);button.disabled=false;}else dashboard();
      });
      document.querySelector('#real-signout').onclick = async () => { await api.auth.signOut(); await syncNav(); login(); };
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
  async function signedPhoto(path) {
    if (!path) return '';
    const {data}=await getClient().storage.from('petcity-media').createSignedUrl(path,3600);
    return data?.signedUrl || '';
  }
  async function uploadPhoto(file, folder) {
    if (!file?.size) return null;
    const extensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
    if (!extensions[file.type] || file.size>5242880) throw new Error('Elegí una imagen JPG, PNG o WebP de hasta 5 MB.');
    const {data:{user}}=await getClient().auth.getUser();
    if (!user) throw new Error('Ingresá de nuevo para subir una foto.');
    const path=`${user.id}/${folder}/${crypto.randomUUID()}.${extensions[file.type]}`;
    const {error}=await getClient().storage.from('petcity-media').upload(path,file,{contentType:file.type,upsert:false});
    if(error) throw error;
    return path;
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
  async function serviceDetail(booking,userId) {
    const api=getClient();
    const [{data:offer},{data:pet},{data:updates,error}]=await Promise.all([
      api.from('sitter_offers').select('service,unit,sitter_applications(public_name)').eq('id',booking.offer_id).single(),
      api.from('pets').select('name,care_notes').eq('id',booking.pet_id).maybeSingle(),
      api.from('care_updates').select('id,message,photo_path,created_at').eq('booking_id',booking.id).order('created_at',{ascending:false})
    ]);
    const sitter=booking.owner_id!==userId;
    open(`<div class="eyebrow">MI SERVICIO</div><h2 id="dialog-title">${esc(serviceLabels[offer?.service]||'Cuidado de mascotas')}</h2><p><strong>${esc(pet?.name||'Mascota')}</strong> · ${esc(offer?.sitter_applications?.public_name||'Cuidador')} · ${esc(stateLabels[booking.status]||booking.status)}</p><p>${esc(booking.start_date)}${booking.end_date!==booking.start_date?' al '+esc(booking.end_date):''} · $${Number(booking.total_price_ars).toLocaleString('es-AR')}</p>${sitter&&pet?.care_notes?`<p>Indicaciones: ${esc(pet.care_notes)}</p>`:''}<div class="dash-tile"><h3>Novedades y fotos</h3>${error?'<p>Las novedades se habilitarán con la próxima actualización.</p>':updates.length?updates.map(u=>`<div style="border-bottom:1px solid #dfe7df;padding:12px 0"><small>${new Date(u.created_at).toLocaleString('es-AR')}</small><p>${esc(u.message)}</p><div data-update-photo="${esc(u.photo_path||'')}"></div></div>`).join(''):'<p>El cuidador todavía no compartió novedades.</p>'}</div>${sitter&&booking.status==='accepted'&&!error?'<form id="care-update-form" class="account-form"><h3>Compartir novedad</h3><label>Mensaje<textarea name="message" maxlength="1000" required placeholder="Contale al dueño cómo va el cuidado"></textarea></label><label>Foto opcional<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><button class="primary">Publicar novedad</button></form>':''}<p class="fine">El recorrido en vivo estará disponible cuando se habilite el seguimiento con permiso de ubicación.</p><p id="account-status" role="status"></p><button class="secondary" id="back-account">Volver a mis cuidados</button>`);
    document.querySelector('#back-account').onclick=()=>{accountTab='services';dashboard();};
    document.querySelector('#back-account').insertAdjacentHTML('beforebegin',`<section class="dash-tile" style="margin:18px 0"><h3>Mensajes del servicio</h3><p class="fine">Conversación privada entre el dueño y el cuidador.</p><div id="service-messages" class="message-list" aria-label="Mensajes del servicio">Cargando conversación…</div><form id="service-message-form" class="chat-form" hidden><label for="service-message-input" style="position:absolute;width:1px;height:1px;overflow:hidden">Tu mensaje</label><input id="service-message-input" name="body" maxlength="2000" required placeholder="Coordiná horarios o consultá cómo va el cuidado" autocomplete="off"><button class="primary" type="submit">Enviar</button></form><p id="service-message-status" class="fine" role="status" aria-live="polite"></p></section>`);
    await serviceMessages(booking,userId);
    document.querySelectorAll('[data-update-photo]').forEach(async node=>{const url=await signedPhoto(node.dataset.updatePhoto);if(url)node.innerHTML=`<img src="${esc(url)}" alt="Foto de la novedad" style="max-width:100%;border-radius:16px">`;});
    document.querySelector('#care-update-form')?.addEventListener('submit',async event=>{event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;try{const form=new FormData(event.target);const path=await uploadPhoto(form.get('photo'),`care/${booking.id}`);const {error:saveError}=await api.from('care_updates').insert({booking_id:booking.id,sitter_id:userId,message:String(form.get('message')).trim(),photo_path:path});if(saveError)throw saveError;serviceDetail(booking,userId);}catch(e){status(e.message);button.disabled=false;}});
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
    const writable=['pending','accepted'].includes(booking.status);
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
    serviceMessageTimer=setInterval(()=>{
      if(!list.isConnected||!document.querySelector('#overlay').classList.contains('open')){clearInterval(serviceMessageTimer);return;}
      if(!document.hidden)refresh();
    },8000);
  }
  async function community() {
    const api=getClient();
    const {data:auth}=await api.auth.getUser();
    const cutoff=new Date(Date.now()-30*24*60*60*1000).toISOString();
    const [{data:posts,error},{data:likes},{data:comments}]=await Promise.all([
      api.from('community_posts').select('*').eq('status','approved').gte('created_at',cutoff).order('created_at',{ascending:false}).limit(60),
      api.from('community_likes').select('post_id,user_id'),
      api.from('community_comments').select('id,post_id,body,status,created_at').order('created_at',{ascending:true}).limit(200)
    ]);
    if(error){open('<h2 id="dialog-title">Comunidad</h2><p>No pudimos cargar las historias en este momento.</p><button class="secondary" id="back-account">Volver</button>');document.querySelector('#back-account').onclick=auth.user?dashboard:()=>document.querySelector('#overlay').classList.remove('open');return;}
    const cards=(posts||[]).map(p=>`<article id="post-${esc(p.id)}" class="community-card"><div class="community-photo" data-post-photo="${esc(p.photo_path||'')}">${p.photo_path?'Cargando foto…':'🐾'}</div><div class="community-copy"><div class="community-meta"><strong>${esc(p.author_name||'Miembro PetCity')}</strong> · ${esc(p.author_role||'Miembro')}<br>${new Date(p.created_at).toLocaleDateString('es-AR')}</div><p>${esc(p.caption)}</p><div class="community-actions"><button class="secondary" data-like="${esc(p.id)}" aria-label="Me gusta">♥ ${likes?.filter(l=>l.post_id===p.id).length||0}</button><button class="secondary" data-share="${esc(p.id)}">Compartir</button></div>${(comments||[]).filter(c=>c.post_id===p.id).map(c=>`<p class="community-comment">${esc(c.body)}${c.status!=='approved'?' · Pendiente':''}</p>`).join('')}${auth.user?`<form data-comment="${esc(p.id)}" class="account-form"><label>Comentar<input name="body" maxlength="500" required></label><button class="dash-call">Comentar</button></form>`:''}</div></article>`).join('');
    const examples=[
      {image:'demo-walk.webp',title:'Paseo de tarde',caption:'Un paseo tranquilo por el barrio y muchas paradas para olfatear.'},
      {image:'demo-park.webp',title:'Descanso en el parque',caption:'Después de jugar, llegó el momento de tomar agua y descansar.'},
      {image:'demo-cat.webp',title:'Siesta junto a la ventana',caption:'El rincón favorito de la casa para disfrutar el sol.'}
    ];
    const demoCards=(posts||[]).length<3?examples.map(item=>`<article class="community-card"><div class="community-photo"><img src="/${item.image}" alt="${esc(item.title)}" loading="lazy"></div><div class="community-copy"><span class="community-example">Ejemplo · imagen ilustrativa</span><div class="community-meta">PetCity · simulación</div><p><strong>${esc(item.title)}</strong><br>${esc(item.caption)}</p></div></article>`).join(''):'';
    open(`<div class="community-head"><div><div class="eyebrow">PETCITY · COMUNIDAD</div><h2 id="dialog-title">Historias de mascotas</h2><p>Historias reales aprobadas visibles durante 30 días · ejemplos identificados</p></div>${auth.user?'<button class="primary" id="show-post-form">+ Subir historia</button>':'<button class="primary" id="community-login">Ingresar para publicar</button>'}</div>${auth.user?'<div class="community-composer" id="community-composer" hidden><h3>Compartir una historia</h3><form id="post-form" class="account-form"><label>Foto<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required></label><label>Contá la historia<textarea name="caption" maxlength="1500" required placeholder="¿Qué pasó hoy?"></textarea></label><button class="primary">Enviar para revisión</button></form><p class="fine">Se muestra tu nombre de perfil (o nombre público de cuidador). Se publica después de la revisión y deja de verse a los 30 días.</p></div>':''}<p id="account-status" role="status" aria-live="polite"></p><div class="community-grid">${cards}${demoCards}</div><button class="secondary" id="back-account" style="margin-top:16px">${auth.user?'Volver a mi perfil':'Cerrar'}</button>`);
    document.querySelector('.modal').classList.add('community-wide');
    document.querySelector('#back-account').onclick=auth.user?dashboard:()=>document.querySelector('#overlay').classList.remove('open');
    document.querySelector('#show-post-form')?.addEventListener('click',()=>{const composer=document.querySelector('#community-composer');composer.hidden=!composer.hidden;if(!composer.hidden)composer.scrollIntoView({block:'nearest'});});
    document.querySelector('#community-login')?.addEventListener('click',()=>login());
    const sharedPost=new URLSearchParams(location.search).get('post');
    if(sharedPost)document.getElementById(`post-${sharedPost}`)?.scrollIntoView({block:'center'});
    document.querySelectorAll('[data-post-photo]').forEach(async node=>{if(!node.dataset.postPhoto)return;const url=await signedPhoto(node.dataset.postPhoto);node.innerHTML=url?`<img src="${esc(url)}" alt="Mascota compartida en PetCity">`:'Foto no disponible';});
    document.querySelector('#post-form')?.addEventListener('submit',async event=>{event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;try{const form=new FormData(event.target);const path=await uploadPhoto(form.get('photo'),'community');const {error:saveError}=await api.from('community_posts').insert({author_id:auth.user.id,caption:String(form.get('caption')).trim(),photo_path:path});if(saveError)throw saveError;community();}catch(e){status(e.message);button.disabled=false;}});
    document.querySelectorAll('[data-like]').forEach(button=>button.onclick=async()=>{if(!auth.user)return login();const liked=likes?.some(l=>l.post_id===button.dataset.like&&l.user_id===auth.user.id);const q=liked?api.from('community_likes').delete().eq('post_id',button.dataset.like).eq('user_id',auth.user.id):api.from('community_likes').insert({post_id:button.dataset.like,user_id:auth.user.id});const {error:likeError}=await q;if(likeError)status(likeError.message);else community();});
    document.querySelectorAll('[data-share]').forEach(button=>button.onclick=async()=>{const url=`${location.origin}/?post=${encodeURIComponent(button.dataset.share)}`;try{if(navigator.share)await navigator.share({title:'PetCity',url});else{await navigator.clipboard.writeText(url);status('Enlace copiado.');}}catch(e){if(e.name!=='AbortError')status('No se pudo compartir.');}});
    document.querySelectorAll('[data-comment]').forEach(form=>form.onsubmit=async event=>{event.preventDefault();const body=String(new FormData(form).get('body')).trim();const {error:commentError}=await api.from('community_comments').insert({post_id:form.dataset.comment,author_id:auth.user.id,body});if(commentError)status(commentError.message);else community();});
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
  let realOffers=[];
  let searchedPlace='';
  const offersSection=document.createElement('section');
  offersSection.id='real-offers';
  offersSection.hidden=true;
  document.querySelector('.categories').after(offersSection);
  const serviceLabels={paseo:'Paseos',cuidado_en_casa:'Cuidado en casa',alojamiento:'Alojamiento',vacaciones:'Vacaciones'};
  const stateLabels={draft:'Borrador',pending:'Pendiente',approved:'Aprobado',changes_requested:'Se pidieron cambios',rejected:'Rechazado',accepted:'Aceptada',cancelled:'Cancelada'};
  function renderRealOffers() {
    if (!realOffers.length) return;
    const category=document.querySelector('.chip.active')?.dataset.category || 'Todos';
    const shown=realOffers.filter(o=>(category==='Todos'||serviceLabels[o.service]===category)&&(!searchedPlace||o.city.toLowerCase().includes(searchedPlace)));
    offersSection.innerHTML=`<div class="results-head"><div><div class="eyebrow">OFERTAS APROBADAS</div><h2>Cuidadores reales · ${shown.length}</h2></div></div>
      <div class="cards">${shown.length?shown.map(o=>`<article class="card" style="padding:22px"><div class="eyebrow">${esc(serviceLabels[o.service])} · ${esc(o.city)}</div>
        <h3>${esc(o.public_name)}</h3><p>${esc(o.bio)}</p><strong>$${Number(o.price_ars).toLocaleString('es-AR')} / ${esc(o.unit)}</strong><br>
        <button class="primary" data-real-offer="${esc(o.id)}" style="margin-top:14px">Solicitar cuidado</button></article>`).join(''):'<p>No hay ofertas aprobadas con esos filtros.</p>'}</div>
      <p class="fine">La solicitud no incluye pago. El cuidador debe aceptarla.</p>`;
    offersSection.querySelectorAll('[data-real-offer]').forEach(button=>button.onclick=()=>realBooking(realOffers.find(o=>o.id===button.dataset.realOffer)));
  }
  async function refreshRealOffers() {
    try {
      const {data,error}=await getClient().from('sitter_applications')
        .select('id,public_name,city,bio,sitter_offers(id,service,price_ars,unit)')
        .eq('status','approved');
      if(error) return;
      realOffers=(data||[]).flatMap(a=>(a.sitter_offers||[]).map(o=>({...o,public_name:a.public_name,city:a.city,bio:a.bio})));
      offersSection.hidden=!realOffers.length;
      document.querySelector('#guest-main .content').hidden=Boolean(realOffers.length);
      if(realOffers.length) renderRealOffers();
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
      if(requestError){status(requestError.message);button.disabled=false;}else {open('<div class="eyebrow">SOLICITUD ENVIADA</div><h2 id="dialog-title">Esperando respuesta del cuidador</h2><p>Podés seguirla en Mi perfil. Todavía no se realizó ningún pago.</p><button class="primary" id="go-account">Ver mi perfil</button>');document.querySelector('#go-account').onclick=dashboard;}
    };
  }
  document.querySelectorAll('.chip').forEach(button=>button.addEventListener('click',()=>setTimeout(renderRealOffers,0)));
  document.querySelector('#search').addEventListener('submit',event=>{if(realOffers.length){event.preventDefault();event.stopImmediatePropagation();searchedPlace=document.querySelector('#place').value.trim().split(',')[0].toLowerCase();renderRealOffers();}},true);
  refreshRealOffers();
  if(new URLSearchParams(location.search).has('post'))setTimeout(community,500);
  document.querySelector('#login-nav').addEventListener('click', event => {
    event.stopImmediatePropagation();
    setTimeout(accountHome, 0);
  }, true);
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
})();
