let userIP = '';
const MAX_REVIEWS_FROM_JSON = 200; // Максимальное количество отзывов из data.json

document.addEventListener('DOMContentLoaded', function() {
    // Получаем IP пользователя
    fetch('https://api.ipify.org?format=json')
        .then(response => response.json())
        .then(data => {
            userIP = data.ip;
            checkUserReview();
        })
        .catch(() => {
            userIP = 'unknown_' + Math.random().toString(36).substr(2, 9);
            checkUserReview();
        });

    initRatingStars();
    loadAndDisplayReviews();

    const reviewForm = document.getElementById('reviewForm');
    if (reviewForm) {
        reviewForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleFormSubmit();
        });
    }
});

// --- Cookie-функции ---
function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value}; expires=${date.toUTCString()}; path=/; SameSite=Lax`;
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return "";
}

// --- Проверка отзыва ---
function checkUserReview() {
    const hasCookie = getCookie("hasSubmittedReview") === "true";
    const reviews = getSavedReviews();
    const hasIP = reviews.some(review => review.ip === userIP);

    if (hasCookie || hasIP) {
        const reviewForm = document.getElementById('reviewForm');
        const addReviewSection = document.querySelector('.add-review');
        if (reviewForm) reviewForm.style.display = 'none';
        if (addReviewSection && !addReviewSection.querySelector('.review-limit')) {
            addReviewSection.innerHTML += `
                <p class="review-limit">Вы уже оставили отзыв. Спасибо!</p>
            `;
        }
    }
}

// --- Работа с отзывами ---
function initRatingStars() {
    const stars = document.querySelectorAll('.rating-stars span');
    stars.forEach(star => {
        star.addEventListener('click', function() {
            const ratingValue = parseInt(this.dataset.value);
            setRating(ratingValue);
        });
    });
}

function setRating(rating) {
    const stars = document.querySelectorAll('.rating-stars span');
    stars.forEach((star, index) => {
        star.classList.toggle('active', index < rating);
    });
}

function resetRating() {
    setRating(0);
}

function handleFormSubmit() {
    const name = document.getElementById('userName').value.trim();
    const text = document.getElementById('userReview').value.trim();
    const rating = getCurrentRating();

    if (!name || !text || rating === 0) {
        alert('Пожалуйста, заполните все поля и поставьте оценку!');
        return;
    }

    // Дополнительная проверка перед сохранением
    if (getCookie("hasSubmittedReview") === "true") {
        alert('Вы уже оставили отзыв ранее!');
        return;
    }

    saveReview(name, text, rating);
    document.getElementById('reviewForm').reset();
    resetRating();
    loadAndDisplayReviews();
}

function getCurrentRating() {
    return document.querySelectorAll('.rating-stars span.active').length;
}

function saveReview(name, text, rating) {
    const reviews = getSavedReviews();
    const newReview = {
        name,
        text,
        rating,
        date: new Date().toISOString(),
        ip: userIP
    };

    reviews.unshift(newReview);
    localStorage.setItem('userReviews', JSON.stringify(reviews));
    setCookie("hasSubmittedReview", "true", 365); // Храним 1 год

    // Блокируем форму после отправки
    document.getElementById('reviewForm').style.display = 'none';
    document.querySelector('.add-review').innerHTML += `
        <p class="review-limit">Спасибо за ваш отзыв!</p>
    `;
}

function getSavedReviews() {
    const reviews = localStorage.getItem('userReviews');
    return reviews ? JSON.parse(reviews) : [];
}

// --- Загрузка и отображение отзывов ---
function loadAndDisplayReviews() {
    Promise.all([loadStaticReviews(), Promise.resolve(getSavedReviews())])
        .then(([staticReviews, userReviews]) => {
            // Ограничиваем количество отзывов из data.json
            const limitedStaticReviews = staticReviews.slice(0, MAX_REVIEWS_FROM_JSON);
            const allReviews = [...userReviews, ...limitedStaticReviews];
            displayReviews(allReviews);
        })
        .catch(error => {
            console.error('Ошибка загрузки отзывов:', error);
            displayReviews(getSavedReviews());
        });
}

function loadStaticReviews() {
    return fetch('data.json')
        .then(response => {
            if (!response.ok) throw new Error('Ошибка загрузки data.json');
            return response.json();
        })
        .then(reviews => {
            if (!Array.isArray(reviews)) return [];

            // Помечаем только 50% отзывов как "Подтверждённый Клиент"
            return reviews.map((review, index) => ({
                ...review,
                isStatic: index % 6 === 0 // Каждый второй будет помечен
            }));
        })
        .catch(error => {
            console.error('Ошибка:', error);
            return [];
        });
}

function displayReviews(reviews) {
    const container = document.getElementById('reviewsContainer');
    if (!container) return;

    container.innerHTML = '';

    // Сортировка по дате (новые сначала)
    reviews.sort((a, b) => new Date(b.date) - new Date(a.date));

    reviews.forEach(review => {
        const reviewElement = createReviewElement(review);
        container.appendChild(reviewElement);
    });
}

function createReviewElement(review) {
    const element = document.createElement('div');
    element.className = 'review';

    const date = new Date(review.date);
    const dateString = date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const stars = '★'.repeat(Math.max(1, Math.min(5, review.rating)));
    const staticBadge = review.isStatic ? '<span class="static-badge">Подтверждённый Клиент</span>' : '';

    element.innerHTML = `
        <div class="review-header">
            <div class="review-author">${review.name}</div>
            <div class="review-rating">${stars}</div>
        </div>
        <div class="review-text">${review.text}</div>
        <div class="review-date">
            ${dateString}
            ${staticBadge}
        </div>
    `;

    return element;
}
document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('toggleSupport');
    const supportContent = document.querySelector('.support-content');
    const closeBtn = document.querySelector('.close-btn');

    if (toggleButton && supportContent) {
        // Проверяем мобильное устройство
        const isMobile = window.matchMedia("(max-width: 768px)").matches;
        
        if (isMobile) {
            toggleButton.addEventListener('click', function() {
                supportContent.classList.toggle('active');
            });
            
            if (closeBtn) {
                closeBtn.addEventListener('click', function() {
                    supportContent.classList.remove('active');
                });
            }
            
            document.addEventListener('click', function(e) {
                if (!supportContent.contains(e.target) && e.target !== toggleButton) {
                    supportContent.classList.remove('active');
                }
            });
        } else {
            supportContent.style.display = 'block';
        }
    }
});
