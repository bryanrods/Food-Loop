// Lógica principal de la aplicación Food-Loop

(async function () {
  'use strict';

  // 1. FUNCIÓN PARA CARGAR EL NAVBAR DINÁMICO
  async function cargarNavbar() {
    const placeholder = document.getElementById('navbar-placeholder');
    if (placeholder) {
      try {
        const response = await fetch('navbar.html');
        const html = await response.text();
        placeholder.innerHTML = html;

        // Reactivamos la hamburguesa SOLO cuando el menú ya se inyectó
        const hamburger = document.getElementById('hamburger');
        const navMenu = document.getElementById('navMenu');
        if (hamburger && navMenu) {
          hamburger.addEventListener('click', function () {
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('toggle');
          });
        }
      } catch (err) {
        console.error('Error al cargar la barra de navegación:', err);
      }
    }
  }

  // ==========================================
  // NUEVA FUNCIÓN: CONTROLADOR GLOBAL DE SESIÓN
  // ==========================================
  function verificarEstadoSesionNav() {
      const usuarioGuardado = localStorage.getItem('usuarioFoodLoop');
      const navMenu = document.getElementById('navMenu');

      if (usuarioGuardado && navMenu) {
          const usuario = JSON.parse(usuarioGuardado);
          
          const enlaceDashboard = usuario.rol === 'local' ? 'dashboard-local.html' : 'dashboard-usuario.html';
          const textoBoton = usuario.rol === 'local' ? 'Mi Local' : 'Mi Perfil';

          // Buscamos el botón principal dentro del menú recién inyectado
          const ctaBtn = navMenu.querySelector('.cta-btn');
          
          if (ctaBtn) {
              ctaBtn.textContent = textoBoton;
              // Removemos el onclick viejo (que llevaba a comenzar.html)
              ctaBtn.removeAttribute('onclick');
              // Le asignamos el nuevo destino
              ctaBtn.addEventListener('click', (e) => {
                  e.preventDefault();
                  window.location.href = enlaceDashboard;
              });
              
              // Inyectamos el botón de Cerrar Sesión si no existe
              if (!document.getElementById('btn-cerrar-global')) {
                  const btnCerrar = document.createElement('button');
                  btnCerrar.id = 'btn-cerrar-global';
                  btnCerrar.className = 'nav-link'; 
                  
                  btnCerrar.style.background = 'none';
                  btnCerrar.style.border = 'none';
                  btnCerrar.style.color = '#d32f2f'; 
                  btnCerrar.style.fontWeight = 'bold';
                  btnCerrar.style.cursor = 'pointer';
                  btnCerrar.style.fontSize = '1rem';
                  
                  btnCerrar.textContent = 'Cerrar Sesión';
                  
                  btnCerrar.addEventListener('click', () => {
                      localStorage.removeItem('usuarioFoodLoop');
                      window.location.href = 'index.html';
                  });
                  
                  navMenu.insertBefore(btnCerrar, ctaBtn);
              }
          }
      }
  }

  // Ejecutamos la carga del menú e inmediatamente después verificamos la sesión
  await cargarNavbar();
  verificarEstadoSesionNav(); // <-- ¡AQUÍ ESTÁ LA MAGIA!

  // 2. REGISTRO DEL SERVICE WORKER
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.log('Service Worker registration failed:', err);
      });
    });
  }

  // 3. INICIALIZACIÓN DE SWIPERS
  if (typeof Swiper !== 'undefined') {
    const mainSwiperEl = document.querySelector('.mainSwiper');
    if (mainSwiperEl) {
      new Swiper('.mainSwiper', {
        slidesPerView: 1,
        spaceBetween: 30,
        loop: true,
        autoplay: { delay: 4000, disableOnInteraction: false },
        pagination: { el: '.swiper-pagination', clickable: true },
        navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
        breakpoints: { 640: { slidesPerView: 2 }, 1024: { slidesPerView: 3 } }
      });
    }
    const testimonialSwiperEl = document.querySelector('.testimonialSwiper');
    if (testimonialSwiperEl) {
      new Swiper('.testimonialSwiper', {
        slidesPerView: 1,
        spaceBetween: 30,
        loop: true,
        autoplay: { delay: 4500, disableOnInteraction: false },
        pagination: { el: '.swiper-pagination', clickable: true },
        navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
        breakpoints: { 768: { slidesPerView: 2 }, 1024: { slidesPerView: 3 } }
      });
    }
    const teamSwiperEl = document.querySelector('.teamSwiper');
    if (teamSwiperEl) {
      new Swiper('.teamSwiper', {
        slidesPerView: 1,
        spaceBetween: 0,
        loop: true,
        autoplay: { delay: 3500, disableOnInteraction: false },
        pagination: { el: '.swiper-pagination', clickable: true }
      });
    }
  }

  // 4. MANEJO DE ERRORES DE IMAGEN
  function handleImageError(img) {
    img.style.display = 'none';
    const parent = img.parentElement;
    if (parent) {
      const placeholder = parent.querySelector(
        '.gallery-placeholder, .img-placeholder, .team-placeholder, .masonry-placeholder, .icon-placeholder'
      );
      if (placeholder) placeholder.style.display = 'flex';
    }
  }

  document.querySelectorAll('img').forEach(function (img) {
    img.addEventListener('error', function () {
      handleImageError(this);
    });
  });

  // 5. ANIMACIÓN DE CONTADORES
  function animateCounter(element, start, end, duration = 2000) {
    if (!element) return;
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    const timer = setInterval(function () {
      current += increment;
      if (current >= end) {
        current = end;
        clearInterval(timer);
      }
      element.innerText = Math.floor(current).toLocaleString();
    }, 16);
  }

  const counter1 = document.getElementById('counter1');
  const counter2 = document.getElementById('counter2');
  const counter3 = document.getElementById('counter3');
  const counter4 = document.getElementById('counter4');
  if (counter1) {
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          if (entry.target.id === 'counter1') animateCounter(entry.target, 5000, 0, 2500);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    observer.observe(counter1);
    if (counter2) counter2.innerText = '0';
    if (counter3) counter3.innerText = '$0';
    if (counter4) counter4.innerText = '0';
  }

  // 6. APARICIÓN GRADUAL DE ELEMENTOS
  const animatedBoxes = document.querySelectorAll('.feature-box, .testimonial-card');
  if (animatedBoxes.length) {
    const appearObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('feature-visible');
          appearObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    animatedBoxes.forEach(function (box) {
      box.classList.add('feature-hidden');
      appearObserver.observe(box);
    });
  }

  // 7. SCROLL SUAVE
  document.addEventListener('click', function(e) {
      const link = e.target.closest('.nav-link[href^="#"]');
      if (!link) return;
      
      e.preventDefault();
      const targetId = link.getAttribute('href');
      if (targetId === '#') return;
      
      const targetSection = document.querySelector(targetId);
      if (targetSection) {
          targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          
          const navMenu = document.getElementById('navMenu');
          const hamburger = document.getElementById('hamburger');
          if (navMenu && navMenu.classList.contains('active')) {
              navMenu.classList.remove('active');
              hamburger.classList.remove('toggle');
          }
      }
  });
  
})();

// Esperar a que el HTML y los recursos de la página carguen por completo
window.addEventListener('load', () => {
  const splashScreen = document.getElementById('splash-screen');
  
  // Agregamos un ligero retraso de 1.5 segundos (1500 ms)
  // para garantizar que el usuario alcance a apreciar el logo y la animación
  setTimeout(() => {
    splashScreen.classList.add('oculto');
  }, 1500); 
});