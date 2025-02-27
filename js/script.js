// Main JavaScript file for the portfolio website

document.addEventListener('DOMContentLoaded', function() {
            // Preloader
            const loader = document.querySelector('.loader');
            const progressBar = document.querySelector('.progress');

            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 10;
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(interval);
                    setTimeout(() => {
                        loader.style.opacity = '0';
                        setTimeout(() => {
                            loader.style.display = 'none';
                            // Start animations after preloader
                            document.querySelectorAll('.skill-group.active .progress').forEach(bar => {
                                setTimeout(() => {
                                    bar.style.width = bar.parentElement.previousElementSibling.querySelector('.percentage').textContent;
                                }, 500);
                            });
                        }, 500);
                    }, 500);
                }
                progressBar.style.width = `${progress}%`;
            }, 100);

            // Navigation
            const nav = document.querySelector('nav');
            const menuToggle = document.querySelector('.menu-toggle');
            const menu = document.querySelector('.menu');
            const menuLinks = document.querySelectorAll('.menu a');

            // Sticky navbar
            window.addEventListener('scroll', function() {
                if (window.scrollY > 50) {
                    nav.classList.add('sticky');
                } else {
                    nav.classList.remove('sticky');
                }
            });

            // Mobile menu toggle
            menuToggle.addEventListener('click', function() {
                menuToggle.classList.toggle('active');
                menu.classList.toggle('active');
            });

            // Close menu when clicking menu items
            menuLinks.forEach(link => {
                link.addEventListener('click', function() {
                    menuToggle.classList.remove('active');
                    menu.classList.remove('active');

                    // Update active menu item
                    menuLinks.forEach(item => item.classList.remove('active'));
                    this.classList.add('active');
                });
            });

            // Active menu item based on scroll position
            const sections = document.querySelectorAll('section');

            window.addEventListener('scroll', function() {
                let current = '';

                sections.forEach(section => {
                    const sectionTop = section.offsetTop;
                    const sectionHeight = section.clientHeight;

                    if (scrollY >= sectionTop - 200) {
                        current = section.getAttribute('id');
                    }
                });

                menuLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href').substring(1) === current) {
                        link.classList.add('active');
                    }
                });
            });

            // Skills tabs
            const categories = document.querySelectorAll('.category');
            const skillGroups = document.querySelectorAll('.skill-group');

            categories.forEach(category => {
                category.addEventListener('click', function() {
                    // Update active category
                    categories.forEach(item => item.classList.remove('active'));
                    this.classList.add('active');

                    // Show corresponding skill group
                    const target = this.getAttribute('data-category');
                    skillGroups.forEach(group => {
                        group.classList.remove('active');
                        if (group.classList.contains(target)) {
                            group.classList.add('active');

                            // Animate progress bars
                            group.querySelectorAll('.progress').forEach(bar => {
                                bar.style.width = '0';
                                setTimeout(() => {
                                    bar.style.width = bar.parentElement.previousElementSibling.querySelector('.percentage').textContent;
                                }, 100);
                            });
                        }
                    });
                });
            });

            // Portfolio filter
            const filterButtons = document.querySelectorAll('.filter-btn');
            const portfolioItems = document.querySelectorAll('.portfolio-item');

            filterButtons.forEach(button => {
                button.addEventListener('click', function() {
                    // Update active filter button
                    filterButtons.forEach(item => item.classList.remove('active'));
                    this.classList.add('active');

                    // Filter portfolio items
                    const filter = this.getAttribute('data-filter');
                    portfolioItems.forEach(item => {
                        if (filter === 'all' || item.getAttribute('data-category') === filter) {
                            item.style.display = 'block';
                            setTimeout(() => {
                                item.style.opacity = '1';
                                item.style.transform = 'scale(1)';
                            }, 50);
                        } else {
                            item.style.opacity = '0';
                            item.style.transform = 'scale(0.8)';
                            setTimeout(() => {
                                item.style.display = 'none';
                            }, 300);
                        }
                    });
                });
            });

            // Portfolio modal
            const portfolioLinks = document.querySelectorAll('.portfolio-link');
            const modal = document.querySelector('.project-modal');
            const modalContainer = document.querySelector('.modal-container');
            const modalClose = document.querySelector('.modal-close');
            const modalContent = document.querySelector('.modal-content');

            portfolioLinks.forEach(link => {
                        link.addEventListener('click', function(e) {
                                    e.preventDefault();
                                    const projectId = this.getAttribute('data-id');

                                    // Simulate loading project details (in a real app, you would fetch this data)
                                    const projectData = getProjectData(projectId);

                                    // Populate modal with project data
                                    modalContent.innerHTML = `
                <div class="project-details">
                    <div class="project-images">
                        <img src="/api/placeholder/800/500" alt="${projectData.title}">
                    </div>
                    <div class="project-info">
                        <h2>${projectData.title}</h2>
                        <p class="project-category">${projectData.category}</p>
                        <div class="project-description">
                            ${projectData.description}
                        </div>
                        <div class="project-meta">
                            <div class="meta-item">
                                <h4>Client</h4>
                                <p>${projectData.client}</p>
                            </div>
                            <div class="meta-item">
                                <h4>Date</h4>
                                <p>${projectData.date}</p>
                            </div>
                            <div class="meta-item">
                                <h4>Skills</h4>
                                <ul class="project-skills">
                                    ${projectData.skills.map(skill => `<li>${skill}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                        <div class="project-actions">
                            <a href="${projectData.liveUrl}" class="btn primary" target="_blank">View Live</a>
                            <a href="${projectData.codeUrl}" class="btn secondary" target="_blank">View Code</a>
                        </div>
                    </div>
                </div>
            `;
            
            // Show modal
            modalContainer.style.display = 'flex';
            setTimeout(() => {
                modalContainer.style.opacity = '1';
                modal.style.transform = 'translateY(0)';
            }, 10);
        });
    });
    
    // Close modal
    modalClose.addEventListener('click', closeModal);
    modalContainer.addEventListener('click', function(e) {
        if (e.target === modalContainer) {
            closeModal();
        }
    });
    
    function closeModal() {
        modalContainer.style.opacity = '0';
        modal.style.transform = 'translateY(-50px)';
        setTimeout(() => {
            modalContainer.style.display = 'none';
        }, 300);
    }
    
    // Helper function to get project data
    function getProjectData(projectId) {
        // In a real application, this would come from a database or API
        const projects = {
            project1: {
                title: 'E-commerce Platform',
                category: 'Web Development',
                description: '<p>A comprehensive e-commerce solution built with React and Node.js. Features include product management, cart functionality, payment processing, and user authentication.</p><p>The platform includes an admin dashboard for inventory management and sales analytics.</p>',
                client: 'RetailCorp',
                date: 'January 2023',
                skills: ['React', 'Node.js', 'MongoDB', 'Stripe API'],
                liveUrl: '#',
                codeUrl: '#'
            },
            project2: {
                title: 'Fitness Tracker App',
                category: 'Mobile Development',
                description: '<p>A cross-platform mobile application for tracking workouts, nutrition, and fitness goals. The app provides personalized recommendations based on user activity and progress.</p><p>Features include workout planning, progress visualization, and social sharing capabilities.</p>',
                client: 'FitLife Inc.',
                date: 'March 2023',
                skills: ['React Native', 'Firebase', 'Redux', 'Health API'],
                liveUrl: '#',
                codeUrl: '#'
            },
            project3: {
                title: 'Banking UI Redesign',
                category: 'UI/UX Design',
                description: '<p>A complete redesign of a banking application interface focusing on improved user experience and accessibility. The project included user research, wireframing, prototyping, and usability testing.</p><p>The redesign resulted in a 35% increase in user engagement and a 20% reduction in support tickets.</p>',
                client: 'Global Banking',
                date: 'May 2023',
                skills: ['Figma', 'Adobe XD', 'User Research', 'Prototyping'],
                liveUrl: '#',
                codeUrl: '#'
            },
            project4: {
                title: 'Product Visualization',
                category: '3D Modeling',
                description: '<p>Interactive 3D visualization of product designs for an e-commerce furniture store. Users can view products from any angle, customize materials, and see products in different settings.</p><p>The visualization is optimized for web performance while maintaining high-quality renders.</p>',
                client: 'Modern Interiors',
                date: 'July 2023',
                skills: ['Three.js', 'WebGL', 'Blender', 'GLSL Shaders'],
                liveUrl: '#',
                codeUrl: '#'
            },
            project5: {
                title: 'Educational Platform',
                category: 'Web Development',
                description: '<p>An online learning platform with course management, interactive lessons, and assessment tools. The platform includes features for both educators and students.</p><p>Key features include video lessons, quizzes, progress tracking, and certificate generation.</p>',
                client: 'EduTech Solutions',
                date: 'September 2023',
                skills: ['Vue.js', 'Laravel', 'MySQL', 'AWS'],
                liveUrl: '#',
                codeUrl: '#'
            },
            project6: {
                title: 'Travel Companion App',
                category: 'Mobile Development',
                description: '<p>A travel planning and exploration app that helps users discover destinations, plan itineraries, and navigate during trips. The app works offline and integrates with maps and local services.</p><p>Features include trip planning, local recommendations, and travel journal capabilities.</p>',
                client: 'Wanderlust Travel',
                date: 'November 2023',
                skills: ['Flutter', 'Google Maps API', 'Firebase', 'Localization'],
                liveUrl: '#',
                codeUrl: '#'
            }
        };
        
        return projects[projectId];
    }
    
    // Contact form submission
    const contactForm = document.getElementById('contactForm');
    const formStatus = document.getElementById('form-status');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(this);
            
            // Show loading state
            formStatus.innerHTML = '<p class="sending">Sending message...</p>';
            
            // Simulate form submission (in a real app, you would use fetch or AJAX)
            setTimeout(() => {
                // Show success message
                formStatus.innerHTML = '<p class="success">Your message has been sent successfully!</p>';
                
                // Reset form
                contactForm.reset();
                
                // Clear success message after some time
                setTimeout(() => {
                    formStatus.innerHTML = '';
                }, 5000);
            }, 1500);
        });
    }
    
    // Back to top button
    const backToTopBtn = document.querySelector('.back-to-top');
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 500) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });
    
    backToTopBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    // Initialize Three.js scene for hero section
    initThreeJsScene();
    
    // Download CV button
    const downloadCvBtn = document.getElementById('download-cv');
    if (downloadCvBtn) {
        downloadCvBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // In a real application, this would download a real file
            alert('CV download would start here. This is just a demo.');
        });
    }
});

// Three.js animation for hero section
function initThreeJsScene() {
    const canvas = document.getElementById('hero-canvas');
    
    if (!canvas) return;
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    canvas.appendChild(renderer.domElement);
    
    // Create particles
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 1500;
    
    const posArray = new Float32Array(particlesCount * 3);
    
    for (let i = 0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 5;
    }
    
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    
    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.005,
        color: 0x5f5ff,
        transparent: true,
        opacity: 0.8
    });
    
    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);
    
    camera.position.z = 2;
    
    // Mouse interaction
    const mouse = {
        x: 0,
        y: 0
    };
    
    window.addEventListener('mousemove', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Animation loop
    const animate = () => {
        requestAnimationFrame(animate);
        
        particlesMesh.rotation.x += 0.0005;
        particlesMesh.rotation.y += 0.0005;
        
        // Subtle mouse interaction
        particlesMesh.rotation.x += mouse.y * 0.0005;
        particlesMesh.rotation.y += mouse.x * 0.0005;
        
        renderer.render(scene, camera);
    };
    
    animate();
}

// GSAP animations for elements
window.addEventListener('load', function() {
    // Hero section animations
    gsap.from('.hero-content h1', { opacity: 0, y: 50, duration: 1, delay: 0.5 });
    gsap.from('.hero-content h2', { opacity: 0, y: 30, duration: 1, delay: 0.7 });
    gsap.from('.hero-content p', { opacity: 0, y: 30, duration: 1, delay: 0.9 });
    gsap.from('.cta-buttons', { opacity: 0, y: 30, duration: 1, delay: 1.1 });
    gsap.from('.scroll-indicator', { opacity: 0, y: -30, duration: 1, delay: 1.5 });
    
    // Initialize ScrollMagic
    initScrollAnimations();
});

// ScrollMagic animations
function initScrollAnimations() {
    const controller = new ScrollMagic.Controller();
    
    // About section animations
    new ScrollMagic.Scene({
        triggerElement: '#about',
        triggerHook: 0.8,
        reverse: false
    })
    .on('enter', function() {
        gsap.from('.about-image', { opacity: 0, x: -50, duration: 1 });
        gsap.from('.about-text', { opacity: 0, x: 50, duration: 1, delay: 0.3 });
    })
    .addTo(controller);
    
    // Skills section animations
    new ScrollMagic.Scene({
        triggerElement: '#skills',
        triggerHook: 0.8,
        reverse: false
    })
    .on('enter', function() {
        gsap.from('.section-header', { opacity: 0, y: 30, duration: 0.8 });
        gsap.from('.skill-categories', { opacity: 0, y: 30, duration: 0.8, delay: 0.3 });
        gsap.from('.skill-display', { opacity: 0, y: 30, duration: 0.8, delay: 0.5 });
    })
    .addTo(controller);
    
    // Portfolio section animations
    new ScrollMagic.Scene({
        triggerElement: '#portfolio',
        triggerHook: 0.8,
        reverse: false
    })
    .on('enter', function() {
        gsap.from('.portfolio-filter', { opacity: 0, y: 30, duration: 0.8, delay: 0.3 });
        gsap.from('.portfolio-item', { 
            opacity: 0, 
            y: 30, 
            duration: 0.8, 
            delay: 0.5,
            stagger: 0.2
        });
    })
    .addTo(controller);
    
    // Experience section animations
    new ScrollMagic.Scene({
        triggerElement: '#experience',
        triggerHook: 0.8,
        reverse: false
    })
    .on('enter', function() {
        gsap.from('.timeline-item', { 
            opacity: 0, 
            x: -50, 
            duration: 0.8,
            stagger: 0.3
        });
    })
    .addTo(controller);
    
    // Contact section animations
    new ScrollMagic.Scene({
        triggerElement: '#contact',
        triggerHook: 0.8,
        reverse: false
    })
    .on('enter', function() {
        gsap.from('.contact-info', { opacity: 0, x: -50, duration: 0.8 });
        gsap.from('.contact-form', { opacity: 0, x: 50, duration: 0.8, delay: 0.3 });
    })
    .addTo(controller);
}