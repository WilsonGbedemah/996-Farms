// Banner functionality
const banner = document.querySelector(".banner");
const now = new Date();
const dayOfWeek = now.getDay();

// Show banner on Mondays (1) and Tuesdays (2)
if (dayOfWeek == 1 || dayOfWeek == 2 || dayOfWeek == 3 || dayOfWeek == 4 || dayOfWeek == 5) {
    banner.style.display = "block";
}

// Close banner functionality
document.querySelector('.close-banner')?.addEventListener('click', () => {
    banner.style.display = "none";
});

// Dynamic year and last modified
document.getElementById("year").textContent = new Date().getFullYear();
document.getElementById("lastmodified").textContent = new Date(document.lastModified).toLocaleDateString();

// Carousel Navigation
const carouselDots = document.querySelectorAll('.carousel-dot');
const featuresContainer = document.querySelector('.features-container');

let screenwidth = window.innerWidth;
let Dwidth;

if (screenwidth <= 360) {
    Dwidth = 210;
} else if (screenwidth > 360 && screenwidth <= 480) {
    Dwidth = 210;
} else if (screenwidth > 480 && screenwidth <= 786) {
    Dwidth = 130;
} else if (screenwidth > 786 && screenwidth <= 1024) {
    Dwidth = 70;
} else {
    Dwidth = 75;
}

carouselDots.forEach((dot, index) => {
    dot.addEventListener('click', (e) => {
        e.preventDefault();
        const slideWidth = Dwidth / carouselDots.length;
        featuresContainer.style.transform = `translateX(-${index * slideWidth}%)`;
        carouselDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
    });
});

carouselDots[0].classList.add('active');

// Steps container animation
const stepsContainer = document.querySelector('.products .steps-container');
if (stepsContainer) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
            } else {
                entry.target.classList.remove('animate');
            }
        });
    }, { 
        threshold: 0.4
    });
    observer.observe(stepsContainer);
}

// Read More Button Functionality
document.querySelectorAll('.read-more-btn').forEach(button => {
    button.addEventListener('click', function() {
        const featureBox = this.closest('.feature-box');
        featureBox.classList.toggle('expanded');
        this.textContent = featureBox.classList.contains('expanded') ? 'Read Less' : 'Read More';
    });
});