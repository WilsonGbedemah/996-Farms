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

// Animate both Products and Catalog steps containers
const stepsContainers = document.querySelectorAll('.steps-container');

stepsContainers.forEach(container => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
            } else {
                entry.target.classList.remove('animate');
            }
        });
    }, { 
        threshold: 0.3
    });
    observer.observe(container);
});

// Access catalog by button
function showCatalog() {
    const catalog = document.getElementById('catalog');
    if (catalog) {
        catalog.scrollIntoView({ behavior: 'smooth' });
    }
}

// Read More Button Functionality
document.querySelectorAll('.read-more-btn').forEach(button => {
    button.addEventListener('click', function() {
        const featureBox = this.closest('.feature-box');
        featureBox.classList.toggle('expanded');
        this.textContent = featureBox.classList.contains('expanded') ? 'Read Less' : 'Read More';
    });
});

// Access catalog by button
function showCatalog() {
    const catalogSteps = document.querySelector('.catalog-section .steps-container');
    if (catalogSteps) {
        catalogSteps.classList.add('animate');
        document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
    }
}


// Video hover preview
const videos = document.querySelectorAll('.video-wrapper video');

videos.forEach(video => {
    video.addEventListener('mouseenter', () => {
        video.currentTime = 0;
        video.muted = true;
        video.play();
    });

    video.addEventListener('mouseleave', () => {
        video.pause();
        video.currentTime = 0;
    });

    video.addEventListener('click', () => {
        video.muted = false;
        video.setAttribute('controls', 'controls');
        video.play();
    });
});

// Enhanced Pineapple Interaction
const pineapple = document.querySelector('.pineapple');
const pineappleSvg = document.querySelector('.pineapple svg');

// Add hover effect
pineapple.addEventListener('mouseenter', () => {
    pineappleSvg.style.animationPlayState = 'paused';
    pineappleSvg.style.transform = 'rotateY(0deg) rotateX(0deg) scale(1.1)';
    pineappleSvg.style.filter = 'drop-shadow(0 15px 30px rgba(0,0,0,0.4)) drop-shadow(0 0 25px rgba(234, 200, 76, 0.8))';
});

pineapple.addEventListener('mouseleave', () => {
    pineappleSvg.style.animationPlayState = 'running';
    pineappleSvg.style.transform = 'rotateY(15deg) rotateX(5deg) scale(1)';
    pineappleSvg.style.filter = 'drop-shadow(0 10px 20px rgba(0,0,0,0.3)) drop-shadow(0 0 15px rgba(234, 200, 76, 0.6))';
});

// Touch interaction for mobile
let touchTimer;
pineapple.addEventListener('touchstart', () => {
    clearTimeout(touchTimer);
    pineappleSvg.style.animationPlayState = 'paused';
    pineappleSvg.style.transform = 'rotateY(0deg) rotateX(0deg) scale(1.1)';
    pineappleSvg.style.filter = 'drop-shadow(0 15px 30px rgba(0,0,0,0.4)) drop-shadow(0 0 25px rgba(234, 200, 76, 0.8))';
    
    touchTimer = setTimeout(() => {
        pineappleSvg.style.animationPlayState = 'running';
        pineappleSvg.style.transform = 'rotateY(15deg) rotateX(5deg) scale(1)';
        pineappleSvg.style.filter = 'drop-shadow(0 10px 20px rgba(0,0,0,0.3)) drop-shadow(0 0 15px rgba(234, 200, 76, 0.6))';
    }, 2000);
});

pineapple.addEventListener('touchend', () => {
    clearTimeout(touchTimer);
});