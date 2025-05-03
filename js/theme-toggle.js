// Theme switcher functionality
document.addEventListener('DOMContentLoaded', () => {
  const toggleSwitch = document.querySelector('#checkbox');
  const currentTheme = localStorage.getItem('theme') || 'dark'; // Default to dark

  // Set initial theme on load
  document.documentElement.setAttribute('data-theme', currentTheme);
  
  // If theme is light, toggle the switch (as dark is the default position)
  if (currentTheme === 'light') {
    toggleSwitch.checked = false;
  } else {
    toggleSwitch.checked = true;
  }

  // Listen for toggle changes
  toggleSwitch.addEventListener('change', function(e) {
    if (this.checked) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  });
});
