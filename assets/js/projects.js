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
// Register projects-specific error codes with AppErrors, if loaded.
if (window.AppErrors && typeof window.AppErrors.registerCode === 'function') {
  AppErrors.registerCode('PROJECTS_FETCH_FAILED', { severity: 'error', publicMessage: 'Projects could not be loaded.' });
}

// Safe fallback: works whether or not app-errors.js is loaded.
function reportError(error, context = {}) {
  if (window.AppErrors && typeof window.AppErrors.report === 'function') {
    window.AppErrors.report(error, context);
    return;
  }
  console.error(error, context);
}

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

function shortLangLabel(language) {
    return language === 'JavaScript' ? 'JS' : language;
}

function createCard(repo) {
    const card = document.createElement('div');
    card.className = 'col-md-6 col-lg-4 mb-4 project-card-wrapper';
    card.dataset.language = repo.language || '';

    const langColor = getLangColor(repo.language);
    const language = repo.language
        ? `<span class="badge badge-dynamic" style="background-color: ${langColor}">${shortLangLabel(repo.language)}</span>`
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
               View on <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="icon" viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"/></svg> Github
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
    allBtn.className = 'btn btn-outline-dark btn-sm me-2 mb-2';
    allBtn.textContent = 'All';
    allBtn.onclick = () => {
        activeLang = null;
        renderFilteredProjects();
    };
    filterBar.appendChild(allBtn);

    langs.forEach(lang => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm me-2 mb-2';
        btn.style.backgroundColor = dynamicLangColors[lang];
        btn.style.color = '#fff';
        btn.textContent = shortLangLabel(lang);
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
    container.innerHTML = '<div class="col-12 text-center text-muted py-5"><span class="spinner spinner-lg"></span><div class="mt-2">Loading projects...</div></div>';

    try {
        for (const user of users) {
            try {
                const repos = await fetchRepos(user);
                const filtered = repos.filter(r => {
                    if (!filterTopic) return true;
                    return r.topics && r.topics.includes(filterTopic);
                });
                filtered.forEach(repo => {
                    const card = createCard(repo);
                    allProjects.push(card);
                });
            } catch (err) {
                // One user's GitHub API failure (rate limit, 404, network)
                // shouldn't wipe out projects already loaded from others.
                reportError(err, { component: 'projects', operation: 'load', code: 'PROJECTS_FETCH_FAILED', metadata: { user } });
            }
        }

        if (allProjects.length === 0) {
            container.innerHTML = '<div class="col-12 text-center text-danger">Error loading projects. Please try again later.</div>';
            return;
        }

        updateFilterButtons();
        renderFilteredProjects();
    } catch (err) {
        // Unexpected failure outside the per-user fetch loop (e.g. rendering)
        // — genuinely unforeseen, not a GitHub API blip.
        reportError(err, { component: 'projects', operation: 'load', code: 'PROJECTS_FETCH_FAILED' });
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