/**
 * Smooth Scroll-Driven Frame Scrubbing Engine
 * Features:
 * - Preloads all sequence frames with hardware decode
 * - Dual-frame alpha cross-fading for seamless 60fps interpolation
 * - Smooth lerp momentum physics (inertia scroll)
 * - Cinematic subtle dolly zoom & interactive mouse parallax
 * - High-DPI / Retina responsive canvas cover logic
 */

(function () {
  'use strict';

  // --- Configuration ---
  const HERO_BG_PATH = 'assets/hero_bg.jpg';

  // Physics lerp speeds
  const SCROLL_EASE = 0.08;      // Smoothness factor for scroll momentum
  const PARALLAX_EASE = 0.06;    // Smoothness factor for mouse parallax

  // DOM Elements
  const canvas = document.getElementById('scrubCanvas');
  const ctx = canvas.getContext('2d');
  const loader = document.getElementById('loader');
  const progressBar = document.getElementById('progressBar');
  const scrollHint = document.getElementById('scrollHint');

  // State
  const images = [];
  let loadedCount = 0;
  let isReady = false;

  // Scroll targets & interpolated values
  let targetProgress = 0;
  let currentProgress = 0;

  // Mouse Parallax targets & interpolated values
  let targetMouseX = 0;
  let targetMouseY = 0;
  let currentMouseX = 0;
  let currentMouseY = 0;

  // Screen & Image Dimensions
  let canvasWidth = 0;
  let canvasHeight = 0;
  let dpr = 1;

  // --- Background Preloading ---
  function preloadImages() {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = HERO_BG_PATH;

      img.onload = async () => {
        if ('decode' in img) {
          try {
            await img.decode();
          } catch (_) {}
        }
        images[0] = img;
        resolve();
      };

      img.onerror = () => {
        const fallback = new Image();
        fallback.src = 'assets/frames/frame_001.png';
        fallback.onload = () => {
          images[0] = fallback;
          resolve();
        };
        fallback.onerror = resolve;
      };
    });
  }

  // --- Responsive Canvas Resizing ---
  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2 for optimal 60fps performance
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;

    canvas.width = Math.round(canvasWidth * dpr);
    canvas.height = Math.round(canvasHeight * dpr);
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';

    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (isReady) {
      render();
    }
  }

  // --- Scroll Progress Calculation ---
  function updateScrollTarget() {
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    targetProgress = maxScroll > 0 ? Math.min(Math.max(scrollY / maxScroll, 0), 1) : 0;

    // Fade out scroll cue when user initiates scrolling
    const cue = scrollHint || document.querySelector('.scroll-cue');
    if (cue) {
      if (targetProgress > 0.02) {
        cue.style.opacity = '0';
        cue.style.transform = 'translateY(12px)';
        cue.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      } else {
        cue.style.opacity = '0.75';
        cue.style.transform = 'translateY(0)';
      }
    }

    // Toggle Floating Quick-Profile Dock
    const floatingDock = document.getElementById('floatingProfileDock');
    if (floatingDock) {
      if (scrollY > 280) {
        floatingDock.classList.add('visible');
      } else {
        floatingDock.classList.remove('visible');
      }
    }

    // Update Active Navigation Item
    updateActiveNavItem();
  }

  function updateActiveNavItem() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.site-header .nav-item');
    const scrollPos = window.pageYOffset + 140;

    sections.forEach((sec) => {
      const top = sec.offsetTop;
      const height = sec.offsetHeight;
      const id = sec.getAttribute('id');

      if (scrollPos >= top && scrollPos < top + height) {
        navLinks.forEach((link) => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }

  // --- Mouse Movement (Subtle 3D Parallax Tilt) ---
  function onMouseMove(e) {
    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;
    targetMouseX = (e.clientX - halfW) / halfW; // -1 to +1
    targetMouseY = (e.clientY - halfH) / halfH; // -1 to +1
  }

  function onTouchMove(e) {
    if (e.touches && e.touches[0]) {
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      targetMouseX = ((e.touches[0].clientX - halfW) / halfW) * 0.5;
      targetMouseY = ((e.touches[0].clientY - halfH) / halfH) * 0.5;
    }
  }

  // --- Draw Image with Cinematic Cover & Offset ---
  function drawCoverImage(img, alpha, scaleFactor, offsetX, offsetY) {
    if (!img || !img.complete || img.naturalWidth === 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;

    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;

    // Aspect-ratio "cover" calculation
    const scale = Math.max(canvasWidth / imgW, canvasHeight / imgH) * scaleFactor;
    const renderW = imgW * scale;
    const renderH = imgH * scale;

    // Horizontal framing: On desktop widescreen, shift slightly right to balance left-side text
    let horizontalBias = 0.5;
    if (canvasWidth > 1100) {
      horizontalBias = 0.65; // Place subject slightly to the right side
    } else if (canvasWidth > 860) {
      horizontalBias = 0.58;
    }

    const dx = (canvasWidth - renderW) * (1 - horizontalBias) + offsetX;

    // Vertical framing: subtle 42% focal bias towards subject's face + parallax offset
    const dy = (canvasHeight - renderH) * 0.40 + offsetY;

    ctx.drawImage(img, dx, dy, renderW, renderH);
    ctx.restore();
  }

  // --- Main Render Function ---
  function render() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Subtle zoom dolly effect on scroll: scale from 1.0 to 1.055
    const dollyScale = 1.0 + currentProgress * 0.055;

    // Subtle parallax translation in pixels (±14px X, ±10px Y)
    const parallaxX = currentMouseX * 14;
    const parallaxY = currentMouseY * 10;

    const bgImg = images[0];
    if (bgImg) {
      drawCoverImage(bgImg, 1.0, dollyScale, parallaxX, parallaxY);
    }

    // Update progress bar
    if (progressBar) {
      progressBar.style.height = `${(currentProgress * 100).toFixed(2)}%`;
    }
  }

  // --- Smooth Animation Loop ---
  function loop() {
    // Lerp scroll progress with inertia
    const scrollDiff = targetProgress - currentProgress;
    currentProgress += scrollDiff * SCROLL_EASE;

    // Lerp mouse parallax
    currentMouseX += (targetMouseX - currentMouseX) * PARALLAX_EASE;
    currentMouseY += (targetMouseY - currentMouseY) * PARALLAX_EASE;

    // Render frame
    render();

    requestAnimationFrame(loop);
  }

  // --- Initialization ---
  async function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });
    window.addEventListener('scroll', updateScrollTarget, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    // Initial scroll position
    updateScrollTarget();
    currentProgress = targetProgress;

    // Preload all frames
    await preloadImages();
    isReady = true;

    // Dismiss preloader smoothly
    setTimeout(() => {
      loader.classList.add('hidden');
    }, 200);

    // Start 60fps render loop
    requestAnimationFrame(loop);

    // Subtle scroll reveal observer for cards and sections
    initScrollReveal();

    // Smooth anchor click handling
    initSmoothAnchorNavigation();

    // Setup Project Quick-View Modal
    initProjectModal();
  }

  // --- Smooth Anchor Navigation ---
  function initSmoothAnchorNavigation() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (!href || href === '#') return;

        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          const headerOffset = 70;
          const targetY = target.getBoundingClientRect().top + window.pageYOffset - headerOffset;

          window.scrollTo({
            top: targetY,
            behavior: 'smooth'
          });

          if (history.pushState) {
            history.pushState(null, null, href);
          }
        }
      });
    });
  }

  // --- Projects Data & Quick-View Modal ---
  const PROJECTS_DATA = {
    1: {
      category: 'Healthcare • FABC (Feb 2026 – Present)',
      title: 'Beyond Horizon — Hospital Patient Record System',
      img: 'assets/projects/beyond_horizon.png',
      desc: 'Designed a modern, clean, and user-friendly healthcare interface for doctors, hospital staff, and patients. Streamlined clinical data organization, real-time vital tracking, and medical history navigation for high-pressure hospital workflows. Features clear visual hierarchy, accessible contrast tokens, and responsive mobile bedside views.',
      tags: ['Healthcare UI', 'Patient Records', 'Figma', 'Design System', 'UX Research', 'Bedside Usability'],
      linkText: 'View in Figma',
      linkUrl: 'https://www.figma.com/design/0BsczOizDWqo5KnwtqZtLf/BH?node-id=0-1'
    },
    2: {
      category: 'EdTech • FABC (Jul 2025 – Jan 2026)',
      title: 'Skellerium — Online Learning Platform',
      img: 'assets/projects/skellerium.png',
      desc: 'Designed end-to-end web and mobile digital education experiences for students and educators. Built intuitive course discovery architectures, interactive student progress dashboards, assessment flows, and high-fidelity clickable prototypes that increased course completion and engagement rates.',
      tags: ['EdTech Platform', 'Dashboard UI', 'Figma', 'Mobile + Web', 'Interactive Prototype', 'Gamified Progress'],
      linkText: 'Visit Live Website',
      linkUrl: 'https://skilleareum.ai/'
    },
    3: {
      category: 'Fintech • FABC (Aug 2025 – Sep 2025)',
      title: 'Stabilix — Blockchain Crypto Trading Platform',
      img: 'assets/projects/stabilix.png',
      desc: 'Designed complete web and mobile trading applications from concept to production. Engineered dark-mode order books, real-time candlestick chart interactions, seamless digital asset swaps, and multi-factor biometric security onboarding flows for international Web3 traders.',
      tags: ['Fintech UX', 'Crypto Trading', 'Dark Mode UI', 'User Flows', 'Prototyping', 'Order Book Interface'],
      linkText: 'View Case Study Preview',
      linkUrl: '#'
    },
    4: {
      category: 'Healthcare Design • 2025',
      title: 'Patient Document Upload Interface',
      img: 'assets/projects/patient_doc.png',
      desc: 'A frictionless healthcare interface built for patients to securely scan, upload, categorize, and submit medical records and insurance papers with instant verification feedback. Focused on radical simplicity, accessibility for all ages, and mobile camera scanning.',
      tags: ['Medical UX', 'Document Upload', 'Figma', 'Accessibility', 'Mobile First', 'Instant Validation'],
      linkText: 'View in Figma',
      linkUrl: 'https://www.figma.com/design/5Uom6MGJYDSB05TzVuRtvu/Upload-Patint-Docm'
    }
  };

  function initProjectModal() {
    const modal = document.getElementById('projectModal');
    const closeBtn = document.getElementById('modalCloseBtn');
    if (!modal) return;

    if (closeBtn) {
      closeBtn.addEventListener('click', closeProjectModal);
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeProjectModal();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeProjectModal();
      }
    });
  }

  window.openProjectModal = function (id) {
    const data = PROJECTS_DATA[id];
    if (!data) return;

    const modal = document.getElementById('projectModal');
    if (!modal) return;

    document.getElementById('modalCategory').textContent = data.category;
    document.getElementById('modalTitle').textContent = data.title;
    document.getElementById('modalImg').src = data.img;
    document.getElementById('modalDesc').textContent = data.desc;

    const tagsContainer = document.getElementById('modalTags');
    tagsContainer.innerHTML = '';
    data.tags.forEach((tag) => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = tag;
      tagsContainer.appendChild(span);
    });

    const actionLink = document.getElementById('modalExternalLink');
    if (actionLink) {
      actionLink.href = data.linkUrl;
      actionLink.querySelector('span').textContent = data.linkText;
      if (data.linkUrl === '#') {
        actionLink.style.display = 'none';
      } else {
        actionLink.style.display = 'inline-flex';
      }
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  window.closeProjectModal = function () {
    const modal = document.getElementById('projectModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  function initScrollReveal() {
    const revealElements = document.querySelectorAll(
      '.about-card, .experience-card, .project-card, .tools-showcase-card, .services-chips-container, .tech-stack-card, .cycle-step-card, .engagement-card, .contact-card-main'
    );
    
    revealElements.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(28px)';
      el.style.transition = 'opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)';
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
      }
    );

    revealElements.forEach((el) => observer.observe(el));
  }

  // Keyboard navigation support
  window.addEventListener('keydown', (e) => {
    const step = window.innerHeight * 0.4;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      window.scrollBy({ top: step, behavior: 'smooth' });
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      window.scrollBy({ top: -step, behavior: 'smooth' });
    } else if (e.key === 'Home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (e.key === 'End') {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
