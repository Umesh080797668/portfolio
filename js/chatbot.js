// AI Chatbot Script
function initChatbot() {
    const chatbotContainer = document.querySelector('.chatbot-container');
    const chatbotToggle = document.querySelector('.chatbot-toggle');
    const chatbotMessages = document.querySelector('.chatbot-messages');
    const chatbotForm = document.getElementById('chatbot-form');
    const userInput = document.getElementById('user-input');

    if (!chatbotContainer || !chatbotToggle || !chatbotMessages || !chatbotForm || !userInput) return;

    // Toggle chatbot window
    chatbotToggle.addEventListener('click', () => {
        chatbotContainer.classList.toggle('active');

        // If opening, focus the input field
        if (chatbotContainer.classList.contains('active')) {
            setTimeout(() => userInput.focus(), 300);
        }
    });

    // Handle form submission
    chatbotForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const message = userInput.value.trim();
        if (!message) return;

        // Add user message to chat
        addMessage('user', message);

        // Clear input field
        userInput.value = '';

        // Show typing indicator
        showTypingIndicator();

        // Process the message and respond after a delay
        setTimeout(() => {
            // Remove typing indicator
            const typingIndicator = document.querySelector('.typing-indicator');
            if (typingIndicator) {
                chatbotMessages.removeChild(typingIndicator);
            }

            // Get and display bot response
            const response = getBotResponse(message);
            addMessage('bot', response);
        }, 1000 + Math.random() * 1000); // Random delay between 1-2 seconds
    });

    // Function to add a message to the chat
    function addMessage(sender, content) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);

        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');
        messageContent.textContent = content;

        messageDiv.appendChild(messageContent);
        chatbotMessages.appendChild(messageDiv);

        // Scroll to bottom
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }

    // Function to show typing indicator
    function showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.classList.add('typing-indicator');

        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.classList.add('typing-dot');
            typingDiv.appendChild(dot);
        }

        chatbotMessages.appendChild(typingDiv);
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }

    // ---- Services & pricing helpers (data comes from js/services.js) ----
    function getServices() {
        return window.TechAssistServices || null;
    }

    function findItem(id) {
        const svc = getServices();
        if (!svc) return null;
        for (const cat of svc.categories) {
            for (const item of cat.items) {
                if (item.id === id) return item;
            }
        }
        return null;
    }

    function priceLine(id) {
        const svc = getServices();
        const item = findItem(id);
        if (!svc || !item) return '';
        if (item.price == null) return '- ' + item.name + ': quote based';
        const unit = { fixed: '', hour: ' / hour', month: ' / month' }[item.unit] || '';
        return '- ' + item.name + ': ' + (item.from ? 'from ' : '') + svc.format(item.price) + unit;
    }

    function priceReply(ids, intro) {
        const lines = ids.map(priceLine).filter(Boolean);
        if (!lines.length) return null;
        return intro + '\n' + lines.join('\n') + '\n\nFinal price depends on scope. You can add these to a quotation in the Pricing section.';
    }

    // Topic matchers for specific price questions
    const PRICE_TOPICS = [
        { re: /(school|institute|institution|management system|student management)/, ids: ['school-sys'], intro: 'For school / institute systems:' },
        { re: /(flutter|mobile|android|ios|\bapp\b|application)/, ids: ['mobile-app', 'web-app'], intro: 'For apps:' },
        { re: /(e-?commerce|online store|online shop)/, ids: ['ecom'], intro: 'For online stores:' },
        { re: /(wordpress)/, ids: ['wp'], intro: 'For WordPress:' },
        { re: /(website|web site|web dev|landing page|portfolio site)/, ids: ['portfolio-site', 'biz-site', 'wp', 'maint'], intro: 'Website pricing:' },
        { re: /(\bapi\b|database|backend)/, ids: ['api-db', 'db-design'], intro: 'For APIs and databases:' },
        { re: /(tutor|tuition|a\/l|\bal\b|\bict\b|programming|python|java|coding|class)/, ids: ['al-ict', 'prog-tutor', 'uni-guide', 'final-year'], intro: 'Tutoring and academic guidance:' },
        { re: /(install|windows|ubuntu|linux|driver|printer|scanner|troubleshoot|repair)/, ids: ['os-install', 'os-full', 'dev-tools', 'troubleshoot', 'printer', 'remote'], intro: 'Installation and tech support:' },
        { re: /(\bcv\b|resume|proofread|translat|pdf|word|document|report|assignment|presentation|powerpoint)/, ids: ['cv', 'proof', 'pdf-word', 'translate', 'report-format', 'ppt'], intro: 'Documents and presentations:' },
        { re: /(excel|data|automation|quiz)/, ids: ['excel', 'data-auto', 'online-class'], intro: 'Data and other digital services:' },
        { re: /(bug|fix|debug)/, ids: ['bugfix'], intro: 'For bug fixing:' }
    ];

    // Function to generate bot responses based on user input
    function getBotResponse(message) {
        // Convert input to lowercase for easier matching
        const input = message.toLowerCase();
        const asksPrice = /(\bprice|\bpricing|\bcost|\brates?\b|\bcharge|\bfees?\b|how much|\brs\b|\blkr\b|\bbudget|\bcheap|\bafford)/.test(input);
        const asksQuote = /(quote|quotation|estimate|invoice|proposal)/.test(input);
        const asksServices = /(service|offer|help with|can you do|what do you do|do you (do|build|make|fix|teach))/.test(input);
        const asksTracking = /(track|tracking|status|where is my|check my|progress|deliverable|trk-)/.test(input);
        const asksFileUpload = /(upload|send file|send pdf|excel file|attach|attachment|document file)/.test(input);

        // Real-time tracking questions
        if (asksTracking) {
            const codeMatch = message.toUpperCase().match(/TRK-[A-Z0-9-]+/);
            if (codeMatch) {
                return `You can track code **${codeMatch[0]}** directly on our Real-Time Tracker! Visit services.html?track=${codeMatch[0]} to see live status, milestones, and deliverables.`;
            }
            return "You can track your assessment or project in real-time on our Work Tracker!\n\nJust visit the Services page (services.html#track) and enter your tracking code (e.g. TRK-DEMO-2026) to see live milestone updates and download completed deliverables.";
        }

        // File upload questions
        if (asksFileUpload) {
            return "Yes, you can easily attach files! When requesting a quotation or contacting Imantha, you can upload PDFs, Excel files (.xlsx, .xls), Word docs (.docx), TXT, code, or ZIPs up to 25MB. Once uploaded, you'll be given a real-time tracking code to follow your work status.";
        }

        // Quotation requests
        if (asksQuote) {
            return "You can build a quotation yourself in the Get Quote section: add services from the Pricing section, set hours or quantity, enter your details and download it as a PDF or send it to Imantha on WhatsApp or email. For larger projects, a final quotation is confirmed after discussing your requirements.";
        }

        // Specific price questions
        if (asksPrice) {
            for (const topic of PRICE_TOPICS) {
                if (topic.re.test(input)) {
                    const reply = priceReply(topic.ids, topic.intro);
                    if (reply) return reply;
                }
            }
            return "All prices are listed in LKR in the Pricing section, for example tutoring from Rs. 1,000/hour, OS installation from Rs. 1,500, portfolio websites from Rs. 15,000 and business websites from Rs. 25,000. Tell me what you need and I'll point you to the right price, or use the Get Quote section for an instant estimate.";
        }

        // Services overview
        if (asksServices) {
            return "Imantha (TechAssist LK) offers:\n- Academic and student support (A/L ICT, programming tutoring, project guidance)\n- Documents and writing (proofreading, CVs, translation)\n- Installation and tech support (Windows, Ubuntu, dev tools)\n- Web and software development (websites, Flutter apps, custom systems, APIs)\n- Other digital services (databases, Excel automation, quiz setup)\n\nSee the Services and Pricing sections for details.";
        }

        // Define response patterns
        if (/\b(hello|hi|hey)\b/.test(input)) {
            return "Hello there! How can I help you today? You can ask about services, pricing or getting a quotation.";
        } else if (input.includes('name')) {
            return "I'm Portfolio AI, Imantha's personal assistant. Nice to meet you!";
        } else if (input.includes('portfolio') || input.includes('website')) {
            return "This portfolio showcases Imantha's work in full-stack web and mobile development. Feel free to explore the projects section, or check the Services section if you'd like to work together!";
        } else if (input.includes('contact') || input.includes('hire') || input.includes('job') || input.includes('whatsapp') || input.includes('phone')) {
            return "You can contact Imantha through the contact form, via WhatsApp on +94 704 124 816, or by email at Umeshbandara08@gmail.com";
        } else if (input.includes('project') || input.includes('work')) {
            return "Imantha has worked on web applications, mobile apps, management systems and websites. Check out the Projects section to see examples of his work.";
        } else if (input.includes('skill') || input.includes('technology') || input.includes('tech')) {
            return "Imantha is a full-stack developer working with HTML, CSS, JavaScript, TypeScript, React, Next.js, Node.js, Flutter, SQL databases and more, along with design tools like Figma. See the Skills section for the full list.";
        } else if (input.includes('experience') || input.includes('background')) {
            return "Imantha is studying for a Bachelor's degree in Information Technology at the University of Colombo (External). He has various certifications in web development and design.";
        } else if (input.includes('thank')) {
            return "You're welcome! Feel free to ask if you have any other questions.";
        } else if (input.includes('bye') || input.includes('goodbye')) {
            return "Goodbye! Feel free to reach out if you have more questions later.";
        } else {
            return "That's an interesting question. You can ask me about services, pricing or quotations, or contact Imantha directly through the contact form or WhatsApp button.";
        }
    }
}

document.addEventListener('DOMContentLoaded', initChatbot);