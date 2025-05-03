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

    // Function to generate bot responses based on user input
    function getBotResponse(message) {
        // Convert input to lowercase for easier matching
        const input = message.toLowerCase();

        // Define response patterns
        if (input.includes('hello') || input.includes('hi') || input.includes('hey')) {
            return "Hello there! How can I help you today?";
        } else if (input.includes('name')) {
            return "I'm Portfolio AI, Imantha's personal assistant. Nice to meet you!";
        } else if (input.includes('portfolio') || input.includes('website')) {
            return "This portfolio showcases Imantha's skills in web development, including HTML, CSS, JavaScript, PHP, and more. Feel free to explore the projects section!";
        } else if (input.includes('contact') || input.includes('hire') || input.includes('job')) {
            return "You can contact Imantha directly through the contact form, via WhatsApp, or by email at Umeshbandara08@gmail.com";
        } else if (input.includes('project') || input.includes('work')) {
            return "Imantha has worked on several projects including e-commerce websites, landing pages, and portfolio sites. Check out the Projects section to see examples of his work.";
        } else if (input.includes('skill') || input.includes('technology') || input.includes('tech')) {
            return "Imantha is skilled in HTML, CSS, JavaScript, PHP, SQL, Angular, and various design tools like Figma and Adobe software. He's particularly strong in frontend development.";
        } else if (input.includes('experience') || input.includes('background')) {
            return "Imantha is studying for a Bachelor's degree in Information Technology at the University of Colombo (External). He has various certifications in web development and design.";
        } else if (input.includes('thank')) {
            return "You're welcome! Feel free to ask if you have any other questions.";
        } else if (input.includes('bye') || input.includes('goodbye')) {
            return "Goodbye! Feel free to reach out if you have more questions later.";
        } else {
            return "That's an interesting question. For more specific information, please contact Imantha directly through the contact form or WhatsApp button.";
        }
    }
}

document.addEventListener('DOMContentLoaded', initChatbot);