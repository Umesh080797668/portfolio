/**
 * Portfolio Website JavaScript
 * Three.js 3D Elements, Animations, and Interactivity
 */

// Wait for DOM content to be loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the loader
    setTimeout(() => {
        document.body.classList.remove('loading');
        document.querySelector('.loader').style.opacity = '0';
        setTimeout(() => {
            document.querySelector('.loader').style.display = 'none';
        }, 500);
    }, 3000);

    // Initialize custom cursor
    initCursor();

    // Initialize navigation
    initNavigation();

    // Initialize scroll animations
    initScrollAnimations();

    // Initialize Three.js scenes
    initThreeJS();

    // Initialize particle background
    initParticles();

    // Initialize form animations
    initFormAnimations();
});

/**
 * Custom cursor functionality
 */
function initCursor() {
    const cursor = document.querySelector('.custom-cursor');
    const cursorDot = document.querySelector('.cursor-dot');

    document.addEventListener('mousemove', (e) => {
        cursor.style.opacity = '1';
        cursorDot.style.opacity = '1';
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
        cursorDot.style.left = `${e.clientX}px`;
        cursorDot.style.top = `${e.clientY}px`;
    });

    document.addEventListener('mouseout', () => {
        cursor.style.opacity = '0';
        cursorDot.style.opacity = '0';
    });

    // Custom cursor interactions
    const interactiveElements = document.querySelectorAll('a, button, .project-card, .skill-item, .form-input');

    interactiveElements.forEach(element => {
        element.addEventListener('mouseenter', () => {
            cursor.style.width = '50px';
            cursor.style.height = '50px';
            cursor.style.border = '2px solid var(--secondary)';
            cursorDot.style.backgroundColor = 'var(--secondary)';
        });

        element.addEventListener('mouseleave', () => {
            cursor.style.width = '30px';
            cursor.style.height = '30px';
            cursor.style.border = '2px solid var(--primary)';
            cursorDot.style.backgroundColor = 'var(--secondary)';
        });
    });
}

/**
 * Navigation functionality
 */
function initNavigation() {
    // Sticky navigation
    window.addEventListener('scroll', () => {
        const nav = document.querySelector('.navigation');

        if (window.scrollY > 100) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });

    // Mobile navigation toggle
    const navToggle = document.querySelector('.nav-toggle');
    const mobileNav = document.querySelector('.mobile-nav');

    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        mobileNav.classList.toggle('active');
        document.body.classList.toggle('nav-open');
    });

    // Close mobile nav when clicking a link
    const mobileLinks = document.querySelectorAll('.mobile-nav-link');

    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('active');
            mobileNav.classList.remove('active');
            document.body.classList.remove('nav-open');
        });
    });
}

/**
 * Scroll animations using IntersectionObserver
 */
function initScrollAnimations() {
    // Scroll reveal animations
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const appearElements = document.querySelectorAll('.appear-animation');

    const appearObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                appearObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    appearElements.forEach(element => {
        appearObserver.observe(element);
    });

    // Skill bar animations
    const skillBars = document.querySelectorAll('.skill-progress');

    const skillObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const width = element.style.width;
                element.style.setProperty('--progress-width', width);
                element.style.width = '0';
                element.classList.add('animate');
                skillObserver.unobserve(element);
            }
        });
    }, observerOptions);

    skillBars.forEach(bar => {
        skillObserver.observe(bar);
    });
}

/**
 * Three.js 3D scenes
 */
function initThreeJS() {
    // Hero 3D Scene
    function initHeroScene() {
        const canvas = document.getElementById('hero-webgl');

        if (!canvas) return;

        // Scene setup
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true,
            antialias: true
        });

        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const pointLight1 = new THREE.PointLight(0x7000ff, 2, 100);
        pointLight1.position.set(-10, 10, 10);
        scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x00e5ff, 2, 100);
        pointLight2.position.set(10, -10, 10);
        scene.add(pointLight2);

        // Create blob geometry
        const blobGeometry = new THREE.SphereGeometry(5, 64, 64);

        // Create blob material
        const blobMaterial = new THREE.MeshPhongMaterial({
            color: 0x000000,
            wireframe: true,
            emissive: 0x7000ff,
            emissiveIntensity: 0.5,
            shininess: 100
        });

        // Create the blob mesh
        const blob = new THREE.Mesh(blobGeometry, blobMaterial);
        scene.add(blob);

        // Position camera
        camera.position.z = 15;

        // Animation loop
        function animate() {
            requestAnimationFrame(animate);

            // Rotate the blob
            blob.rotation.x += 0.005;
            blob.rotation.y += 0.01;

            // Wave effect
            const time = Date.now() * 0.001;
            const positionAttribute = blob.geometry.attributes.position;

            for (let i = 0; i < positionAttribute.count; i++) {
                const x = positionAttribute.getX(i);
                const y = positionAttribute.getY(i);
                const z = positionAttribute.getZ(i);

                const distance = Math.sqrt(x * x + y * y + z * z);
                const originalDistance = 5;

                // Wave deformation
                const deformation = Math.sin(distance * 2 + time * 2) * 0.2;

                // Update the position
                const newX = x * (originalDistance + deformation) / originalDistance;
                const newY = y * (originalDistance + deformation) / originalDistance;
                const newZ = z * (originalDistance + deformation) / originalDistance;

                positionAttribute.setX(i, newX);
                positionAttribute.setY(i, newY);
                positionAttribute.setZ(i, newZ);
            }

            positionAttribute.needsUpdate = true;

            renderer.render(scene, camera);
        }

        // Handle window resize
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        animate();
    }

    // Skills 3D Scene
    function initSkillsScene() {
        const canvas = document.getElementById('skills-webgl');

        if (!canvas) return;

        // Scene setup
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true,
            antialias: true
        });

        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0x7000ff, 1, 100);
        pointLight.position.set(5, 5, 5);
        scene.add(pointLight);

        // Create particles
        const particleCount = 1000;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            // Position in 3D space
            positions[i * 3] = (Math.random() - 0.5) * 10;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 10;

            // Color (gradient between primary and secondary)
            const t = Math.random();
            colors[i * 3] = (1 - t) * (112 / 255) + t * (0 / 255); // R
            colors[i * 3 + 1] = (1 - t) * (0 / 255) + t * (229 / 255); // G
            colors[i * 3 + 2] = (1 - t) * (255 / 255) + t * (255 / 255); // B
        }

        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const particleMaterial = new THREE.PointsMaterial({
            size: 0.1,
            vertexColors: true,
            transparent: true,
            opacity: 0.8
        });

        const particles = new THREE.Points(particleGeometry, particleMaterial);
        scene.add(particles);

        // Position camera
        camera.position.z = 5;

        // Animation loop
        function animate() {
            requestAnimationFrame(animate);

            // Rotate the particles
            particles.rotation.x += 0.001;
            particles.rotation.y += 0.002;

            renderer.render(scene, camera);
        }

        // Handle window resize
        window.addEventListener('resize', () => {
            camera.aspect = canvas.clientWidth / canvas.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        });

        animate();
    }

    // Contact 3D Scene
    function initContactScene() {
        const canvas = document.getElementById('contact-webgl');

        if (!canvas) return;

        // Scene setup
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true,
            antialias: true
        });

        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Create torus knot
        const torusGeometry = new THREE.TorusKnotGeometry(3, 0.8, 100, 16);
        const torusMaterial = new THREE.MeshNormalMaterial({
            wireframe: true
        });

        const torusKnot = new THREE.Mesh(torusGeometry, torusMaterial);
        scene.add(torusKnot);

        // Position camera
        camera.position.z = 10;

        // Animation loop
        function animate() {
            requestAnimationFrame(animate);

            // Rotate the torus knot
            torusKnot.rotation.x += 0.005;
            torusKnot.rotation.y += 0.01;

            renderer.render(scene, camera);
        }

        // Handle window resize
        window.addEventListener('resize', () => {
            camera.aspect = canvas.clientWidth / canvas.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        });

        animate();
    }

    // Initialize all 3D scenes
    initHeroScene();
    initSkillsScene();
    initContactScene();
}

/**
 * Initialize particles background
 */
function initParticles() {
    if (typeof particlesJS !== 'undefined') {
        particlesJS("particles-js", {
            particles: {
                number: {
                    value: 80,
                    density: {
                        enable: true,
                        value_area: 800
                    }
                },
                color: {
                    value: "#ffffff"
                },
                shape: {
                    type: "circle",
                    stroke: {
                        width: 0,
                        color: "#000000"
                    },
                    polygon: {
                        nb_sides: 5
                    }
                },
                opacity: {
                    value: 0.15,
                    random: true,
                    anim: {
                        enable: true,
                        speed: 1,
                        opacity_min: 0.05,
                        sync: false
                    }
                },
                size: {
                    value: 3,
                    random: true,
                    anim: {
                        enable: true,
                        speed: 2,
                        size_min: 0.1,
                        sync: false
                    }
                },
                line_linked: {
                    enable: true,
                    distance: 150,
                    color: "#7000ff",
                    opacity: 0.2,
                    width: 1
                },
                move: {
                    enable: true,
                    speed: 1,
                    direction: "none",
                    random: false,
                    straight: false,
                    out_mode: "out",
                    bounce: false,
                    attract: {
                        enable: false,
                        rotateX: 600,
                        rotateY: 1200
                    }
                }
            },
            interactivity: {
                detect_on: "canvas",
                events: {
                    onhover: {
                        enable: true,
                        mode: "grab"
                    },
                    onclick: {
                        enable: true,
                        mode: "push"
                    },
                    resize: true
                },
                modes: {
                    grab: {
                        distance: 140,
                        line_linked: {
                            opacity: 0.4
                        }
                    },
                    bubble: {
                        distance: 400,
                        size: 40,
                        duration: 2,
                        opacity: 8,
                        speed: 3
                    },
                    repulse: {
                        distance: 200,
                        duration: 0.4
                    },
                    push: {
                        particles_nb: 4
                    },
                    remove: {
                        particles_nb: 2
                    }
                }
            },
            retina_detect: true
        });
    }
}

/**
 * Form animations and validation
 */
function initFormAnimations() {
    const form = document.getElementById('contact-form');

    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        // Simulate form submission
        const submitBtn = form.querySelector('.submit-btn');
        const originalBtnText = submitBtn.innerHTML;

        submitBtn.innerHTML = '<span>Sending...</span> <i class="fas fa-circle-notch fa-spin"></i>';
        submitBtn.disabled = true;

        setTimeout(() => {
            submitBtn.innerHTML = '<span>Message Sent!</span> <i class="fas fa-check"></i>';
            submitBtn.classList.add('success');

            // Reset form
            form.reset();

            // Reset button after 3 seconds
            setTimeout(() => {
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
                submitBtn.classList.remove('success');
            }, 3000);
        }, 2000);
    });

    // Project card hover effect
    const projectCards = document.querySelectorAll('.project-card');

    projectCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = (y - centerY) / 15;
            const rotateY = (centerX - x) / 15;

            card.style.transform = `translateY(-10px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0) rotateX(0) rotateY(0)';
        });
    });
}