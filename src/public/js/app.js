/**
 * Main Application Logic
 * Manages UI state, playlist editing, and integrates player + API.
 */

import API from './api.js';
import player from './player.js';

const TARGET_SONG_COUNT = 125;

/**
 * Application state manager.
 */
const AppState = {
  currentView: 'empty',
  analysisData: null,
  currentPlaylist: null,
  currentDraft: null,
  searchTimeout: null,
};

/**
 * LocalStorage manager for playlist drafts.
 */
const DraftStorage = {
  KEY: 'playlist_drafts',

  getAll() {
    const drafts = localStorage.getItem(this.KEY);
    return drafts ? JSON.parse(drafts) : [];
  },

  save(draft) {
    const drafts = this.getAll();
    const existingIndex = drafts.findIndex(d => d.id === draft.id);

    if (existingIndex >= 0) {
      drafts[existingIndex] = draft;
    } else {
      drafts.push(draft);
    }

    localStorage.setItem(this.KEY, JSON.stringify(drafts));
    return draft;
  },

  delete(draftId) {
    const drafts = this.getAll().filter(d => d.id !== draftId);
    localStorage.setItem(this.KEY, JSON.stringify(drafts));
  },

  createNew(name = 'New Playlist') {
    return {
      id: Date.now().toString(),
      name,
      tracks: [],
      lockedTrackIds: [],
      spotifyPlaylistId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },
};

/**
 * UI Helper functions.
 */
const UI = {
  showView(viewId) {
    document.getElementById('emptyState')?.classList.add('hidden');
    document.getElementById('analysisView')?.classList.add('hidden');
    document.getElementById('playlistEditor')?.classList.add('hidden');
    document.getElementById('loadingState')?.classList.add('hidden');

    if (viewId === 'empty') {
      document.getElementById('emptyState')?.classList.remove('hidden');
    } else if (viewId === 'analysis') {
      document.getElementById('analysisView')?.classList.remove('hidden');
    } else if (viewId === 'editor') {
      document.getElementById('playlistEditor')?.classList.remove('hidden');
    } else if (viewId === 'loading') {
      document.getElementById('loadingState')?.classList.remove('hidden');
    }

    AppState.currentView = viewId;
  },

  showLoading() {
    this.showView('loading');
  },

  showError(message) {
    alert(`Error: ${message}`);
  },

  formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  },

  formatTotalDuration(ms) {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  },

  createTrackElement(track, index, options = {}) {
    const li = document.createElement('li');
    li.className = 'track-item';
    li.dataset.trackId = track.id;
    li.dataset.trackUri = track.uri;

    if (options.isLocked) {
      li.classList.add('locked');
    }

    const albumArt = track.album?.images?.[0]?.url || '';
    const artistNames = track.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
    const lockIcon = options.isLocked ? '&#128274;' : '&#128275;';
    const lockTitle = options.isLocked ? 'Unlock track' : 'Lock track';
    const lockClass = options.isLocked ? 'btn-lock locked' : 'btn-lock';

    li.innerHTML = `
      ${options.showNumber ? `<span class="track-number">${index + 1}</span>` : ''}
      ${options.showDragHandle ? '<span class="track-drag-handle" draggable="true">&#8942;&#8942;</span>' : ''}
      <button class="track-play-btn" title="Play">&#9658;</button>
      <img class="track-album-art" src="${albumArt}" alt="${track.album?.name || 'Album'}">
      <div class="track-info">
        <div class="track-name">${track.name}</div>
        <div class="track-artist">${artistNames}</div>
      </div>
      <span class="track-duration">${this.formatDuration(track.duration_ms)}</span>
      ${options.showActions ? `
        <div class="track-actions">
          ${options.onLock ? `<button class="${lockClass}" data-action="lock" title="${lockTitle}">${lockIcon}</button>` : ''}
          ${options.onAdd ? '<button class="btn-icon" data-action="add" title="Add">+</button>' : ''}
          ${options.onRemove ? '<button class="btn-icon" data-action="remove" title="Remove">&#10005;</button>' : ''}
        </div>
      ` : ''}
    `;

    // Play button
    const playBtn = li.querySelector('.track-play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await player.playTrack(track.uri);
        } catch (error) {
          console.error('Failed to play track:', error);
          UI.showError('Failed to play track');
        }
      });
    }

    // Action buttons
    if (options.onAdd) {
      li.querySelector('[data-action="add"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        options.onAdd(track);
      });
    }

    if (options.onLock) {
      li.querySelector('[data-action="lock"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        options.onLock(track);
      });
    }

    if (options.onRemove) {
      li.querySelector('[data-action="remove"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        options.onRemove(track, index);
      });
    }

    // Drag and drop
    if (options.showDragHandle) {
      const dragHandle = li.querySelector('.track-drag-handle');

      dragHandle.addEventListener('dragstart', (e) => {
        li.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index);
      });

      li.addEventListener('dragend', () => {
        li.classList.remove('dragging');
      });

      li.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = document.querySelector('.dragging');
        if (dragging && dragging !== li) {
          li.classList.add('drag-over');
        }
      });

      li.addEventListener('dragleave', () => {
        li.classList.remove('drag-over');
      });

      li.addEventListener('drop', (e) => {
        e.preventDefault();
        li.classList.remove('drag-over');

        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
        const toIndex = index;

        if (fromIndex !== toIndex && options.onReorder) {
          options.onReorder(fromIndex, toIndex);
        }
      });
    }

    return li;
  },
};

/**
 * Analysis view management.
 */
const AnalysisView = {
  async load() {
    UI.showLoading();

    try {
      const data = await API.getAnalysis();
      AppState.analysisData = data;
      this.render(data);
      UI.showView('analysis');
    } catch (error) {
      console.error('Failed to load analysis:', error);
      UI.showError('Failed to load analysis');
      UI.showView('empty');
    }
  },

  render(data) {
    // Stats
    document.getElementById('totalArtists').textContent = data.artists.totalUniqueArtists;
    document.getElementById('totalTracks').textContent = data.tracks.totalUniqueTracks;

    // Top genres
    const genresList = document.getElementById('topGenresList');
    genresList.innerHTML = '';
    data.artists.topGenres.slice(0, 5).forEach(genre => {
      const li = document.createElement('li');
      li.className = 'genre-item';
      li.innerHTML = `
        <span style="flex: 1;">${genre.genre}</span>
        <span style="color: var(--text-secondary);">${genre.count} artists</span>
      `;
      genresList.appendChild(li);
    });

    // Top artists
    const artistsList = document.getElementById('topArtistsList');
    artistsList.innerHTML = '';
    data.artists.rankedArtists.slice(0, 20).forEach(artist => {
      const li = document.createElement('li');
      li.className = 'artist-item';
      const imageUrl = artist.images?.[0]?.url || '';
      const genres = artist.genres?.slice(0, 3).join(', ') || 'No genres';

      li.innerHTML = `
        <img class="artist-image" src="${imageUrl}" alt="${artist.name}">
        <div class="artist-info">
          <div class="artist-name">${artist.name}</div>
          <div class="artist-genres">${genres}</div>
        </div>
      `;
      artistsList.appendChild(li);
    });

    // Top tracks
    const tracksList = document.getElementById('topTracksList');
    tracksList.innerHTML = '';
    data.tracks.rankedTracks.slice(0, 50).forEach((track, index) => {
      const trackEl = UI.createTrackElement(track, index, { showNumber: true });
      tracksList.appendChild(trackEl);
    });

    // Favorite tracks
    const favoritesList = document.getElementById('favoriteTracksList');
    favoritesList.innerHTML = '';
    data.tracks.consistentFavorites.slice(0, 20).forEach((track, index) => {
      const trackEl = UI.createTrackElement(track, index, { showNumber: true });
      favoritesList.appendChild(trackEl);
    });
  },
};

/**
 * Playlist editor management.
 */
const PlaylistEditor = {
  currentTracks: [],
  trackIdSet: new Set(),
  lockedTrackIds: new Set(),

  async createNew() {
    const draft = DraftStorage.createNew('Birthday Party Playlist');
    AppState.currentDraft = draft;
    this.currentTracks = [];
    this.trackIdSet = new Set();
    this.lockedTrackIds = new Set();
    this.render();
    UI.showView('editor');
  },

  toggleLock(track) {
    if (this.lockedTrackIds.has(track.id)) {
      this.lockedTrackIds.delete(track.id);
    } else {
      this.lockedTrackIds.add(track.id);
    }
    this.saveDraft();
    this.render();
  },

  unlockAll() {
    this.lockedTrackIds.clear();
    this.saveDraft();
    this.render();
  },

  isAllLocked() {
    return this.currentTracks.length > 0 &&
      this.currentTracks.every(t => this.lockedTrackIds.has(t.id));
  },

  async generatePlaylist() {
    if (this.isAllLocked()) {
      const shouldUnlock = confirm(
        'All tracks are locked. Unlock all tracks to regenerate?'
      );
      if (shouldUnlock) {
        this.unlockAll();
      }
      return;
    }

    UI.showLoading();

    try {
      const birthYearInput = document.getElementById('birthYearInput');
      const birthYear = birthYearInput ? parseInt(birthYearInput.value, 10) : null;

      const lockedTracks = this.currentTracks.filter(t => this.lockedTrackIds.has(t.id));
      const lockedPositions = new Map();
      this.currentTracks.forEach((track, index) => {
        if (this.lockedTrackIds.has(track.id)) {
          lockedPositions.set(track.id, index);
        }
      });

      const excludeTrackIds = lockedTracks.map(t => t.id);
      const targetCount = TARGET_SONG_COUNT - lockedTracks.length;

      const result = await API.generatePlaylist(birthYear, {
        excludeTrackIds,
        targetCount,
      });

      const mergedTracks = this.mergeLockedTracks(
        result.tracks,
        lockedTracks,
        lockedPositions
      );

      this.currentTracks = mergedTracks;
      this.trackIdSet = new Set(mergedTracks.map(t => t.id));
      this.saveDraft();
      this.render();
      UI.showView('editor');
    } catch (error) {
      console.error('Failed to generate playlist:', error);
      UI.showError('Failed to generate playlist');
      UI.showView('empty');
    }
  },

  mergeLockedTracks(newTracks, lockedTracks, lockedPositions) {
    const totalCount = newTracks.length + lockedTracks.length;
    const merged = new Array(totalCount);

    for (const track of lockedTracks) {
      const position = lockedPositions.get(track.id);
      const safePosition = Math.min(position, totalCount - 1);
      merged[safePosition] = track;
    }

    let newIndex = 0;
    for (let i = 0; i < totalCount; i++) {
      if (!merged[i] && newIndex < newTracks.length) {
        merged[i] = newTracks[newIndex++];
      }
    }

    return merged.filter(Boolean);
  },

  addTrack(track) {
    // Block duplicate track IDs
    if (this.trackIdSet.has(track.id)) {
      UI.showError('This track is already in the playlist');
      return;
    }

    this.currentTracks.push(track);
    this.trackIdSet.add(track.id);
    this.saveDraft();
    this.render();
  },

  removeTrack(track, index) {
    this.currentTracks.splice(index, 1);
    this.trackIdSet.delete(track.id);
    this.lockedTrackIds.delete(track.id);
    this.saveDraft();
    this.render();
  },

  reorderTrack(fromIndex, toIndex) {
    const [track] = this.currentTracks.splice(fromIndex, 1);
    this.currentTracks.splice(toIndex, 0, track);
    this.saveDraft();
    this.render();
  },

  saveDraft() {
    if (!AppState.currentDraft) {
      AppState.currentDraft = DraftStorage.createNew();
    }

    const nameInput = document.getElementById('playlistName');
    AppState.currentDraft.name = nameInput?.value || 'New Playlist';
    AppState.currentDraft.tracks = this.currentTracks;
    AppState.currentDraft.lockedTrackIds = Array.from(this.lockedTrackIds);
    AppState.currentDraft.updatedAt = new Date().toISOString();

    DraftStorage.save(AppState.currentDraft);
  },

  async publishToSpotify() {
    if (this.currentTracks.length === 0) {
      UI.showError('Playlist is empty');
      return;
    }

    const nameInput = document.getElementById('playlistName');
    const name = nameInput?.value || 'Birthday Party Playlist';
    const trackIds = this.currentTracks.map(t => t.id);

    try {
      UI.showLoading();

      let result;
      if (AppState.currentDraft?.spotifyPlaylistId) {
        // Update existing playlist
        result = await API.updatePlaylist(
          AppState.currentDraft.spotifyPlaylistId,
          name,
          'Created with Birthday Playlist Analyzer',
          trackIds
        );
        alert('Playlist updated successfully on Spotify!');
      } else {
        // Create new playlist
        result = await API.createPlaylist(
          name,
          'Created with Birthday Playlist Analyzer',
          trackIds
        );

        // Save the Spotify playlist ID
        if (AppState.currentDraft) {
          AppState.currentDraft.spotifyPlaylistId = result.id;
          DraftStorage.save(AppState.currentDraft);
        }

        alert(`Playlist created successfully! Open in Spotify: ${result.url}`);
      }

      UI.showView('editor');
    } catch (error) {
      console.error('Failed to publish playlist:', error);
      UI.showError('Failed to publish playlist to Spotify');
      UI.showView('editor');
    }
  },

  render() {
    const nameInput = document.getElementById('playlistName');
    if (nameInput && AppState.currentDraft) {
      nameInput.value = AppState.currentDraft.name;
    }

    // Update stats
    const trackCount = this.currentTracks.length;
    const totalDuration = this.currentTracks.reduce((sum, t) => sum + (t.duration_ms || 0), 0);

    document.getElementById('trackCount').textContent = `${trackCount} ${trackCount === 1 ? 'track' : 'tracks'}`;
    document.getElementById('playlistDuration').textContent = UI.formatTotalDuration(totalDuration);

    // Update regenerate button state
    const regenerateBtn = document.getElementById('regenerateBtn');
    if (regenerateBtn) {
      regenerateBtn.disabled = this.isAllLocked();
    }

    // Render tracks
    const tracksContainer = document.getElementById('playlistTracks');
    tracksContainer.innerHTML = '';

    this.currentTracks.forEach((track, index) => {
      const trackEl = UI.createTrackElement(track, index, {
        showNumber: true,
        showDragHandle: true,
        showActions: true,
        isLocked: this.lockedTrackIds.has(track.id),
        onLock: (t) => this.toggleLock(t),
        onRemove: (t, i) => this.removeTrack(t, i),
        onReorder: (from, to) => this.reorderTrack(from, to),
      });
      tracksContainer.appendChild(trackEl);
    });
  },
};

/**
 * Search functionality.
 */
const Search = {
  async performSearch(query) {
    if (!query.trim()) {
      document.getElementById('searchResults').classList.add('hidden');
      return;
    }

    try {
      const results = await API.searchTracks(query, 20);
      this.renderResults(results.tracks);
    } catch (error) {
      console.error('Search failed:', error);
    }
  },

  renderResults(tracks) {
    const resultsContainer = document.getElementById('searchResults');
    const resultsList = resultsContainer.querySelector('.track-list');

    if (!tracks || tracks.length === 0) {
      resultsContainer.classList.add('hidden');
      return;
    }

    resultsList.innerHTML = '';
    tracks.forEach((track, index) => {
      const trackEl = UI.createTrackElement(track, index, {
        showActions: true,
        onAdd: (t) => {
          PlaylistEditor.addTrack(t);
          resultsContainer.classList.add('hidden');
        },
      });
      resultsList.appendChild(trackEl);
    });

    resultsContainer.classList.remove('hidden');
  },
};

/**
 * Player UI management.
 */
const PlayerUI = {
  initialize() {
    player.on((event, data) => {
      if (event === 'ready') {
        this.onReady(data);
      } else if (event === 'state_changed') {
        this.onStateChanged(data);
      } else if (event === 'error') {
        this.onError(data);
      }
    });
  },

  onReady(data) {
    console.log('Player ready:', data.deviceId);
    document.getElementById('playerContainer')?.classList.remove('hidden');
    document.getElementById('playerStatus').textContent = 'Ready';
  },

  onStateChanged(data) {
    if (!data) {
      document.getElementById('playerTrackName').textContent = 'No track playing';
      document.getElementById('playerTrackArtist').textContent = '-';
      document.getElementById('playerAlbumArt').src = '';
      this.updatePlayPauseButton(true);
      return;
    }

    document.getElementById('playerTrackName').textContent = data.track.name;
    document.getElementById('playerTrackArtist').textContent = data.track.artists;
    document.getElementById('playerAlbumArt').src = data.track.albumArt;
    this.updatePlayPauseButton(data.paused);

    // Mark currently playing track in lists
    document.querySelectorAll('.track-item.playing').forEach(el => {
      el.classList.remove('playing');
    });

    const playingElement = document.querySelector(`[data-track-id="${data.track.id}"]`);
    if (playingElement) {
      playingElement.classList.add('playing');
    }
  },

  onError(data) {
    console.error('Player error:', data.message);
    document.getElementById('playerStatus').textContent = `Error: ${data.message}`;
  },

  updatePlayPauseButton(isPaused) {
    const playIcon = document.getElementById('playIcon');
    const pauseIcon = document.getElementById('pauseIcon');

    if (isPaused) {
      playIcon?.classList.remove('hidden');
      pauseIcon?.classList.add('hidden');
    } else {
      playIcon?.classList.add('hidden');
      pauseIcon?.classList.remove('hidden');
    }
  },
};

/**
 * Event listeners setup.
 */
function setupEventListeners() {
  // Empty state actions
  document.getElementById('generatePlaylistBtn')?.addEventListener('click', () => {
    PlaylistEditor.generatePlaylist();
  });

  document.getElementById('showAnalysisBtn')?.addEventListener('click', () => {
    AnalysisView.load();
  });

  // Header actions
  document.getElementById('viewAnalysisBtn')?.addEventListener('click', () => {
    AnalysisView.load();
  });

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
      window.location.href = '/logout';
    }
  });

  // Analysis view
  document.getElementById('closeAnalysisBtn')?.addEventListener('click', () => {
    UI.showView('empty');
  });

  // Analysis tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;

      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(tabName)?.classList.add('active');
    });
  });

  // Playlist editor
  document.getElementById('closeEditorBtn')?.addEventListener('click', () => {
    UI.showView('empty');
  });

  document.getElementById('regenerateBtn')?.addEventListener('click', () => {
    const lockedCount = PlaylistEditor.lockedTrackIds.size;
    const message = lockedCount > 0
      ? `This will replace all unlocked tracks (${lockedCount} locked tracks will stay). Continue?`
      : 'This will replace all current tracks. Continue?';
    if (confirm(message)) {
      PlaylistEditor.generatePlaylist();
    }
  });

  document.getElementById('savePlaylistBtn')?.addEventListener('click', () => {
    PlaylistEditor.publishToSpotify();
  });

  // Playlist name auto-save
  document.getElementById('playlistName')?.addEventListener('input', () => {
    PlaylistEditor.saveDraft();
  });

  // Search
  const searchInput = document.getElementById('searchInput');
  searchInput?.addEventListener('input', (e) => {
    clearTimeout(AppState.searchTimeout);
    AppState.searchTimeout = setTimeout(() => {
      Search.performSearch(e.target.value);
    }, 300);
  });

  // Player controls
  document.getElementById('playerPlayPauseBtn')?.addEventListener('click', async () => {
    try {
      await player.togglePlayPause();
    } catch (error) {
      console.error('Failed to toggle playback:', error);
    }
  });

  document.getElementById('playerNextBtn')?.addEventListener('click', async () => {
    try {
      await player.next();
    } catch (error) {
      console.error('Failed to skip to next:', error);
    }
  });

  document.getElementById('playerPrevBtn')?.addEventListener('click', async () => {
    try {
      await player.previous();
    } catch (error) {
      console.error('Failed to skip to previous:', error);
    }
  });
}

/**
 * Application initialization.
 */
async function initialize() {
  console.log('Initializing Birthday Playlist Analyzer...');

  try {
    // Setup event listeners first (these work without player)
    setupEventListeners();

    // Try to initialize player (requires Premium)
    try {
      await player.initialize();
      PlayerUI.initialize();
      console.log('Player initialized successfully');
    } catch (playerError) {
      console.warn('Player initialization failed (Premium may be required):', playerError.message);
      // Player won't work, but rest of app still functions
      document.getElementById('playerContainer')?.classList.add('hidden');
    }

    // Show initial view
    UI.showView('empty');

    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    UI.showError('Failed to initialize the application. Please refresh the page.');
  }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
