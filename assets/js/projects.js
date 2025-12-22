// assets/js/projects.js
/*!
 *
 * contactform_v2.js
 *
 * Contact Form Frontend Script
 * Copyright (c) 2025 Rafał Masiarek. All rights reserved.
 *
 * This file is proprietary and confidential. Unauthorized copying,
 * distribution, modification, or use of this file, in whole or in part,
 * is strictly prohibited without prior written permission of the author.
 *
 * Licensed for internal use only. No license is granted to copy,
 * sublicense, or redistribute this code.
 */
const users = ["rafalmasiarek", "infrastrukturait"];
const filterTopic = ""; // leave empty string to disable filtering

const dynamicLangColors = {};
const allProjects = [];

let activeLang = null;
let hasShrunk = false;

function pastelColor(index) {
    const hue = (index * 47) % 360;
    return `hsl(${hue}, 70%, 60%)`;
}

async function fetchRepos(user) {
    const res = await fetch(`https://api.github.com/users/${user}/repos?per_page=100&sort=updated`);
    if (!res.ok) throw new Error(`GitHub API error for ${user}: ${res.status}`);
    return res.json();
}

function getLangColor(language) {
    if (!language) return '#6c757d';
    if (!dynamicLangColors[language]) {
        const index = Object.keys(dynamicLangColors).length;
        dynamicLangColors[language] = pastelColor(index);
    }
    return dynamicLangColors[language];
}

function createCard(repo) {
    const card = document.createElement('div');
    card.className = 'col-md-6 col-lg-4 mb-4 project-card-wrapper';
    card.dataset.language = repo.language || '';

    const langColor = getLangColor(repo.language);
    const language = repo.language
        ? `<span class="badge badge-dynamic" style="background-color: ${langColor}">${repo.language}</span>`
        : '';

    card.innerHTML = `
        <div class="card shadow-sm project-card h-100">
          <div class="card-body">
            <h5 class="card-title d-flex justify-content-between align-items-center">
              ${repo.name}
              ${language}
            </h5>
            <p class="card-text">${repo.description || 'No description provided.'}</p>
          </div>
          <div class="card-footer bg-white border-top-0">
            <a href="${repo.html_url}" target="_blank" class="btn btn-outline-primary btn-sm"
               data-track="project"
               data-project="${repo.name}"
               data-owner="${repo.owner && repo.owner.login ? repo.owner.login : ''}">
               View on <i class="fab fa-github"></i> Github
            </a>
          </div>
        </div>
      `;
    return card;
}

function updateFilterButtons() {
    const filterBar = document.getElementById('language-filter');
    filterBar.innerHTML = '';
    const langs = Object.keys(dynamicLangColors);
    const allBtn = document.createElement('button');
    allBtn.className = 'btn btn-outline-dark btn-sm';
    allBtn.textContent = 'All';
    allBtn.onclick = () => {
        activeLang = null;
        renderFilteredProjects();
    };
    filterBar.appendChild(allBtn);

    langs.forEach(lang => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm';
        btn.style.backgroundColor = dynamicLangColors[lang];
        btn.style.color = '#fff';
        btn.textContent = lang;
        btn.onclick = () => {
            activeLang = lang;
            renderFilteredProjects();
        };
        filterBar.appendChild(btn);
    });
}

function renderFilteredProjects() {
    const container = document.getElementById('projects-container');
    container.innerHTML = '';
    allProjects.forEach(el => {
        if (!activeLang || el.dataset.language === activeLang) {
            container.appendChild(el);
        }
    });
}

async function loadProjects() {
    const container = document.getElementById('projects-container');

    try {
        for (const user of users) {
            const repos = await fetchRepos(user);
            const filtered = repos.filter(r => {
                if (!filterTopic) return true;
                return r.topics && r.topics.includes(filterTopic);
            });
            filtered.forEach(repo => {
                const card = createCard(repo);
                allProjects.push(card);
            });
        }
        updateFilterButtons();
        renderFilteredProjects();
    } catch (err) {
        console.error('Error fetching repos:', err);
        container.innerHTML = '<div class="col-12 text-center text-danger">Error loading projects. Please try again later.</div>';
    }
}

window.addEventListener('scroll', () => {
    const hero = document.getElementById('hero');
    const shrinkPoint = 100;
    const scrollTop = window.scrollY;
    if (!hasShrunk && scrollTop > shrinkPoint) {
        hero.classList.add('shrink');
        hasShrunk = true;
    }
});

window.addEventListener('load', () => {
    const hero = document.getElementById('hero');
    const shrinkPoint = 100;
    if (window.scrollY > shrinkPoint) {
        hero.classList.add('shrink');
        hasShrunk = true;
    }
});

document.addEventListener('click', function (e) {
    if (!(e.target instanceof Element)) return;

    var a = e.target.closest('a[data-track="project"]');
    if (!a) return;

    if (typeof window.track === 'function') {
        window.track('project_click', {
            project: a.getAttribute('data-project') || '',
            owner: a.getAttribute('data-owner') || '',
            href: a.getAttribute('href') || ''
        });
    }
}, true);

loadProjects();