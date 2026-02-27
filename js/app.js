// Lógica principal de la aplicación Food Loop
// Este archivo se encarga de registrar el Service Worker, manejar la navegación móvil
// e inicializar componentes interactivos como los carruseles y animaciones.

(function () {
  'use strict';

  // Registro del Service Worker para habilitar el modo offline y la instalación como PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/js/sw.js').catch(function (err) {
        console.log('Service Worker registration failed:', err);
      });
    });
  }

  // Menú hamburguesa para navegación en dispositivos móviles
  var hamburger = document.getElementById('hamburger');
  var navMenu = document.getElementById('navMenu');
  if (hamburger && navMenu) {
    hamburger.addEventListener('click', function () {
      navMenu.classList.toggle('active');
      hamburger.classList.toggle('toggle');
    });
  }

  // Inicialización condicional de Swiper únicamente si la biblioteca está disponible
  if (typeof Swiper !== 'undefined') {
    var mainSwiperEl = document.querySelector('.mainSwiper');
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
    var testimonialSwiperEl = document.querySelector('.testimonialSwiper');
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
    var teamSwiperEl = document.querySelector('.teamSwiper');
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

  // Manejador de errores de carga de imágenes que muestra un marcador de posición
  function handleImageError(img) {
    img.style.display = 'none';
    var parent = img.parentElement;
    if (parent) {
      var placeholder = parent.querySelector(
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

  // Función genérica para animar contadores numéricos
  function animateCounter(element, start, end, duration) {
    if (!element) return;
    if (duration === void 0) { duration = 2000; }
    var range = end - start;
    var increment = range / (duration / 16);
    var current = start;
    var timer = setInterval(function () {
      current += increment;
      if (current >= end) {
        current = end;
        clearInterval(timer);
      }
      element.innerText = Math.floor(current).toLocaleString();
    }, 16);
  }

  // Animación de los contadores en la sección de estadísticas
  var counter1 = document.getElementById('counter1');
  var counter2 = document.getElementById('counter2');
  var counter3 = document.getElementById('counter3');
  var counter4 = document.getElementById('counter4');
  if (counter1) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          if (entry.target.id === 'counter1') animateCounter(entry.target, 5000, 12840, 2500);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    observer.observe(counter1);
    if (counter2) counter2.innerText = '2.4M';
    if (counter3) counter3.innerText = '$89M';
    if (counter4) counter4.innerText = '450k';
  }

  // Aparición gradual de cajas de características y testimonios
  var animatedBoxes = document.querySelectorAll('.feature-box, .testimonial-card');
  if (animatedBoxes.length) {
    var appearObserver = new IntersectionObserver(function (entries) {
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
})();