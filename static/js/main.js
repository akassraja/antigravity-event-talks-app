document.addEventListener('DOMContentLoaded', () => {
    // State management
    let allNotes = [];
    let activeTag = 'ALL';
    let searchQuery = '';
    let selectedNoteForTweet = null;

    // DOM Elements
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshIcon = document.getElementById('refresh-icon');
    const refreshText = document.getElementById('refresh-text');
    const lastSyncTime = document.getElementById('last-sync-time');
    
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const tagFilterBtns = document.querySelectorAll('.tag-btn');
    
    const loader = document.getElementById('loader');
    const notesContainer = document.getElementById('notes-container');
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    const retryBtn = document.getElementById('retry-btn');
    const emptyState = document.getElementById('empty-state');
    const resultsCount = document.getElementById('results-count');

    // Tweet Modal Elements
    const tweetModal = document.getElementById('tweet-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const cancelTweetBtn = document.getElementById('cancel-tweet');
    const postTweetBtn = document.getElementById('post-tweet-btn');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCountDisplay = document.getElementById('char-count');
    const modalPreviewDate = document.getElementById('modal-preview-date');
    const modalPreviewTitle = document.getElementById('modal-preview-title');
    const hashtagPills = document.querySelectorAll('.hashtag-pill');

    // Toast Elements
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    // --- Fetching Data ---
    async function fetchReleaseNotes(isManualRefresh = false) {
        setLoadingState(true, isManualRefresh);
        
        try {
            const response = await fetch('/api/release-notes');
            const data = await response.json();
            
            if (data.success) {
                allNotes = data.notes;
                updateSyncTime(data.fetched_at);
                updateCounts();
                renderNotes();
                showToast('Release notes updated successfully!');
            } else {
                showError(data.error || 'Failed to parse RSS feed.');
            }
        } catch (err) {
            console.error('Fetch error:', err);
            showError('Network error connecting to backend service.');
        } finally {
            setLoadingState(false, isManualRefresh);
        }
    }

    function setLoadingState(isLoading, isManualRefresh) {
        if (isLoading) {
            if (isManualRefresh) {
                refreshIcon.classList.add('spin');
                refreshText.textContent = 'Refreshing...';
                refreshBtn.disabled = true;
            } else {
                loader.classList.remove('hidden');
                notesContainer.classList.add('hidden');
                errorContainer.classList.add('hidden');
                emptyState.classList.add('hidden');
            }
        } else {
            refreshIcon.classList.remove('spin');
            refreshText.textContent = 'Refresh Feed';
            refreshBtn.disabled = false;
            loader.classList.add('hidden');
        }
    }

    function updateSyncTime(timestamp) {
        if (timestamp) {
            lastSyncTime.textContent = `Synced: ${timestamp.split(' ')[1]}`;
        } else {
            const now = new Date();
            lastSyncTime.textContent = `Synced: ${now.toLocaleTimeString()}`;
        }
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        errorContainer.classList.remove('hidden');
        notesContainer.classList.add('hidden');
        emptyState.classList.add('hidden');
    }

    // --- Filtering and Rendering ---
    function updateCounts() {
        const counts = {
            ALL: allNotes.length,
            FEATURE: 0,
            CHANGED: 0,
            FIX: 0,
            DEPRECATION: 0
        };

        allNotes.forEach(note => {
            if (counts.hasOwnProperty(note.tag)) {
                counts[note.tag]++;
            }
        });

        document.getElementById('count-all').textContent = counts.ALL;
        document.getElementById('count-feature').textContent = counts.FEATURE;
        document.getElementById('count-changed').textContent = counts.CHANGED;
        document.getElementById('count-fix').textContent = counts.FIX;
        document.getElementById('count-deprecation').textContent = counts.DEPRECATION;
    }

    function getFilteredNotes() {
        return allNotes.filter(note => {
            const matchesTag = (activeTag === 'ALL') || (note.tag === activeTag);
            const contentToSearch = (note.title + ' ' + note.short_summary + ' ' + note.content).toLowerCase();
            const matchesSearch = !searchQuery || contentToSearch.includes(searchQuery.toLowerCase());
            return matchesTag && matchesSearch;
        });
    }

    function renderNotes() {
        const filtered = getFilteredNotes();
        resultsCount.textContent = `Showing ${filtered.length} of ${allNotes.length} updates`;

        if (filtered.length === 0) {
            notesContainer.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        notesContainer.classList.remove('hidden');
        notesContainer.innerHTML = '';

        filtered.forEach(note => {
            const card = document.createElement('article');
            card.className = 'note-card';

            const tagClass = `tag-${note.tag.toLowerCase()}`;
            
            card.innerHTML = `
                <div class="note-header">
                    <span class="note-date"><i class="fa-regular fa-calendar"></i> ${note.formatted_date}</span>
                    <span class="note-tag ${tagClass}">${note.tag}</span>
                </div>
                <h3 class="note-title"><a href="${note.link}" target="_blank" rel="noopener">${escapeHTML(note.title)}</a></h3>
                <div class="note-content">${note.content}</div>
                <div class="note-footer">
                    <div class="note-actions">
                        <button class="btn btn-primary btn-action tweet-btn" data-id="${note.id}">
                            <i class="fa-brands fa-x-twitter"></i> Tweet Update
                        </button>
                        <button class="btn btn-secondary btn-action copy-link-btn" data-link="${note.link}">
                            <i class="fa-regular fa-copy"></i> Copy Link
                        </button>
                    </div>
                </div>
            `;

            notesContainer.appendChild(card);
        });

        // Attach event listeners to newly created buttons
        document.querySelectorAll('.tweet-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const noteId = e.currentTarget.getAttribute('data-id');
                const note = allNotes.find(n => n.id === noteId);
                if (note) openTweetModal(note);
            });
        });

        document.querySelectorAll('.copy-link-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const link = e.currentTarget.getAttribute('data-link');
                navigator.clipboard.writeText(link);
                showToast('Link copied to clipboard!');
            });
        });
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    // --- Tweet Modal Logic ---
    function openTweetModal(note) {
        selectedNoteForTweet = note;
        modalPreviewDate.textContent = note.formatted_date;
        modalPreviewTitle.textContent = note.title;
        
        buildTweetText();
        tweetModal.classList.remove('hidden');
    }

    function buildTweetText() {
        if (!selectedNoteForTweet) return;
        
        // Active hashtags
        const activeHashtags = Array.from(hashtagPills)
            .filter(pill => pill.classList.contains('active'))
            .map(pill => pill.getAttribute('data-tag'))
            .join(' ');

        const baseText = `🚀 BigQuery Update: ${selectedNoteForTweet.title}\n\nCheck out the details here: ${selectedNoteForTweet.link}\n\n${activeHashtags}`;
        tweetTextarea.value = baseText;
        updateCharCount();
    }

    function updateCharCount() {
        const count = tweetTextarea.value.length;
        charCountDisplay.textContent = count;
        const wrapper = document.querySelector('.char-count-wrapper');
        if (count > 280) {
            wrapper.classList.add('over-limit');
        } else {
            wrapper.classList.remove('over-limit');
        }
    }

    function closeTweetModal() {
        tweetModal.classList.add('hidden');
        selectedNoteForTweet = null;
    }

    // --- Event Listeners ---
    refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    retryBtn.addEventListener('click', () => fetchReleaseNotes(false));

    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        if (searchQuery) {
            clearSearchBtn.classList.remove('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
        }
        renderNotes();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.classList.add('hidden');
        renderNotes();
    });

    tagFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tagFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTag = btn.getAttribute('data-tag');
            renderNotes();
        });
    });

    // Modal listeners
    closeModalBtn.addEventListener('click', closeTweetModal);
    cancelTweetBtn.addEventListener('click', closeTweetModal);
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) closeTweetModal();
    });

    tweetTextarea.addEventListener('input', updateCharCount);

    hashtagPills.forEach(pill => {
        pill.addEventListener('click', () => {
            pill.classList.toggle('active');
            buildTweetText();
        });
    });

    postTweetBtn.addEventListener('click', () => {
        const text = encodeURIComponent(tweetTextarea.value);
        const twitterUrl = `https://twitter.com/intent/tweet?text=${text}`;
        window.open(twitterUrl, '_blank', 'noopener,noreferrer');
        closeTweetModal();
        showToast('Opened Twitter / X share window!');
    });

    // Toast Utility
    let toastTimeout;
    function showToast(msg) {
        toastMessage.textContent = msg;
        toast.classList.remove('hidden');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }

    // Initial load
    fetchReleaseNotes();
});
