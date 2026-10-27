// VoyageAI - Application Logic Controller

document.addEventListener("DOMContentLoaded", () => {
  // --- STATE ---
  let currentPlan = null;
  let activeDay = 1;
  let selectedBudget = "Standard";
  let selectedStyle = "Culture";
  let selectedCompanion = "Solo";
  let currentUser = null;
  let savedTrips = [];
  let currentBudgetFilter = "All";
  let currentSearchQuery = "";

  // Preset location list for autocomplete
  const popularPresets = [
    // India originals
    "Jaipur", "Udaipur", "Varanasi", "Agra", "Kochi", "Manali",
    // India new
    "Mumbai", "Delhi", "Goa", "Rishikesh", "Amritsar", "Leh",
    "Jodhpur", "Darjeeling", "Mysuru", "Hampi",
    // Asia & Middle East
    "Bali", "Bangkok", "Singapore", "Seoul", "Dubai",
    // Europe originals
    "Tokyo", "Kyoto", "Paris", "Rome", "Florence", "New York",
    // Europe new
    "Barcelona", "London", "Amsterdam", "Istanbul", "Prague",
    // Americas
    "Rio de Janeiro", "Cusco"
  ];

  // --- UI ELEMENTS ---
  const screens = {
    setup: document.getElementById("setup-screen"),
    loading: document.getElementById("loading-screen"),
    dashboard: document.getElementById("dashboard-screen")
  };

  // Auth Elements
  const btnLoginTrigger = document.getElementById("btn-login-trigger");
  const userProfileMenu = document.getElementById("user-profile-menu");
  const userDisplayName = document.getElementById("user-display-name");
  const btnLogout = document.getElementById("btn-logout");
  const authModal = document.getElementById("auth-modal");
  const btnCloseAuth = document.getElementById("btn-close-auth");
  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const loginErrorMessage = document.getElementById("login-error-message");
  const registerErrorMessage = document.getElementById("register-error-message");
  const registerSuccessMessage = document.getElementById("register-success-message");
  
  // Trip Save / Modal Elements
  const btnSaveTrip = document.getElementById("btn-save-trip");
  const btnMyTripsTrigger = document.getElementById("btn-my-trips-trigger");
  const tripsModal = document.getElementById("trips-modal");
  const btnCloseTrips = document.getElementById("btn-close-trips");
  const tripsListContainer = document.getElementById("trips-list-container");

  const form = document.getElementById("planner-form");
  const destinationInput = document.getElementById("destination-input");
  const autocompleteList = document.getElementById("autocomplete-list");
  const durationSelect = document.getElementById("duration-select");
  const btnGenerate = document.getElementById("btn-generate");
  const btnBackSetup = document.getElementById("btn-back-setup");
  const btnPrint = document.getElementById("btn-print");
  const sourceBadge = document.getElementById("source-badge");

  // Loading Screen Elements
  const loadingProgress = document.getElementById("loading-progress");
  const loadingStatus = document.getElementById("loading-status");
  const loadingTitle = document.getElementById("loading-title");

  // Settings Modal Elements
  const btnApiSettings = document.getElementById("btn-api-settings");
  const settingsModal = document.getElementById("settings-modal");
  const btnCloseSettings = document.getElementById("btn-close-settings");
  const apiKeyStatus = document.getElementById("api-key-status");

  // Dashboard Detail Elements
  const heroDestination = document.getElementById("hero-destination-name");
  const heroDescription = document.getElementById("hero-description");
  const heroStyleBadge = document.getElementById("hero-style-badge");
  const heroBudgetBadge = document.getElementById("hero-budget-badge");
  const statWeather = document.getElementById("stat-weather");
  const statCost = document.getElementById("stat-cost");
  const statDays = document.getElementById("stat-days");
  
  const dayTabsContainer = document.getElementById("day-tabs-container");
  const timelineEvents = document.getElementById("timeline-events");
  const hotelList = document.getElementById("hotel-list");
  const spotsList = document.getElementById("spots-list");
  const routeDetails = document.getElementById("route-details");
  const travelTipsText = document.getElementById("travel-tips-text");
  
  // Interactive Leaflet map instance stored in window.routeMap

  // --- INITIALIZATION ---
  initApp();

  function initApp() {
    // 1. Load API Key state
    geminiAPI.loadConfig().then(updateApiKeyUI);

    // 2. Chip selectors binding
    setupChips("budget-selector", (val) => {
      selectedBudget = val;
      const customContainer = document.getElementById("custom-budget-input-container");
      const customVal = document.getElementById("custom-budget-val");
      if (val === "Custom") {
        customContainer.style.display = "block";
        if (customVal) {
          customVal.focus();
          customVal.required = true;
        }
      } else {
        customContainer.style.display = "none";
        if (customVal) {
          customVal.required = false;
        }
      }
    });
    setupChips("style-selector", (val) => selectedStyle = val);
    setupChips("companion-selector", (val) => selectedCompanion = val);

    // 3. Autocomplete Setup
    setupAutocomplete();

    // 4. Form Submit
    form.addEventListener("submit", handleFormSubmit);

    // 5. Back Button
    btnBackSetup.addEventListener("click", () => {
      showScreen("setup");
    });

    // 6. Settings Modal Toggles
    btnApiSettings.addEventListener("click", () => openModal(settingsModal));
    btnCloseSettings.addEventListener("click", () => closeModal(settingsModal));

    // 7. Print Button
    btnPrint.addEventListener("click", () => window.print());

    // 8. Preset Suggestions Tags click
    document.querySelectorAll(".preset-tag").forEach(tag => {
      tag.addEventListener("click", () => {
        destinationInput.value = tag.getAttribute("data-val");
        destinationInput.focus();
        autocompleteList.style.display = "none";
      });
    });

    // Close autocompletes if clicked outside
    document.addEventListener("click", (e) => {
      if (e.target !== destinationInput) {
        autocompleteList.style.display = "none";
      }
    });

    // 9. Auth and Trip Save Bindings
    checkLoginState();

    if (window.location.protocol === "file:") {
      const fileWarning = document.getElementById("file-protocol-warning");
      if (fileWarning) fileWarning.style.display = "flex";
    }

    btnLoginTrigger.addEventListener("click", () => openAuthModal());
    btnCloseAuth.addEventListener("click", () => closeModal(authModal));
    tabLogin.addEventListener("click", () => switchAuthTab("login"));
    tabRegister.addEventListener("click", () => switchAuthTab("register"));
    loginForm.addEventListener("submit", handleLoginSubmit);
    registerForm.addEventListener("submit", handleRegisterSubmit);
    btnLogout.addEventListener("click", handleLogout);
    btnSaveTrip.addEventListener("click", handleSaveTrip);
    btnMyTripsTrigger.addEventListener("click", () => openTripsModal());
    btnCloseTrips.addEventListener("click", () => closeModal(tripsModal));

    // 10. Saved Trips search and budget filters
    const modalSearchInput = document.getElementById("modal-search-input");
    const modalBudgetFilter = document.getElementById("modal-budget-filter");
    
    if (modalSearchInput) {
      modalSearchInput.addEventListener("input", (e) => {
        currentSearchQuery = e.target.value.trim();
        renderFilteredTrips();
      });
    }
    
    if (modalBudgetFilter) {
      const chips = modalBudgetFilter.querySelectorAll(".chip");
      chips.forEach(chip => {
        chip.addEventListener("click", () => {
          chips.forEach(c => c.classList.remove("active"));
          chip.classList.add("active");
          currentBudgetFilter = chip.getAttribute("data-filter");
          renderFilteredTrips();
        });
      });
    }
  }

  // --- API KEY ACTIONS ---
  function updateApiKeyUI() {
    if (geminiAPI.hasApiKey()) {
      apiKeyStatus.className = "api-key-status active";
      apiKeyStatus.querySelector("span").textContent = "Server API key active. voyageAI will generate live custom itineraries.";
      apiKeyStatus.querySelector("i").className = "fa-solid fa-circle-check";
      btnApiSettings.classList.add("active");
    } else {
      apiKeyStatus.className = "api-key-status";
      apiKeyStatus.querySelector("span").textContent = "No API key set on the server. Running in Demo Simulation Mode.";
      apiKeyStatus.querySelector("i").className = "fa-solid fa-circle-question";
      btnApiSettings.classList.remove("active");
    }
  }

  // --- MODAL UTILS ---
  function openModal(modal) {
    modal.classList.add("active");
  }

  function closeModal(modal) {
    modal.classList.remove("active");
  }

  // --- CHIPS HELPER ---
  function setupChips(containerId, callback) {
    const container = document.getElementById(containerId);
    const chips = container.querySelectorAll(".chip");
    
    chips.forEach(chip => {
      chip.addEventListener("click", () => {
        chips.forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        callback(chip.getAttribute("data-value"));
      });
    });
  }

  // --- AUTOCOMPLETE FOR DEMO CITIES ---
  function setupAutocomplete() {
    destinationInput.addEventListener("input", () => {
      const val = destinationInput.value.toLowerCase().trim();
      autocompleteList.innerHTML = "";
      
      if (!val) {
        autocompleteList.style.display = "none";
        return;
      }

      const filtered = popularPresets.filter(city => city.toLowerCase().includes(val));
      
      if (filtered.length > 0) {
        filtered.forEach(city => {
          const div = document.createElement("div");
          div.className = "autocomplete-item";
          div.textContent = city;
          div.addEventListener("click", () => {
            destinationInput.value = city;
            autocompleteList.style.display = "none";
          });
          autocompleteList.appendChild(div);
        });
        autocompleteList.style.display = "block";
      } else {
        autocompleteList.style.display = "none";
      }
    });
  }

  // --- SCREEN SWITCHER ---
  function showScreen(screenId) {
    Object.keys(screens).forEach(id => {
      if (id === screenId) {
        screens[id].classList.add("active");
        if (screenId === "loading") {
          screens[id].style.display = "flex";
        } else {
          screens[id].style.display = "block";
        }
      } else {
        screens[id].classList.remove("active");
        screens[id].style.display = "none";
      }
    });

    // Reset body background when returning to setup screen
    if (screenId === "setup") {
      document.body.style.removeProperty('--body-bg-image');
    }
  }

  // --- SUBMIT / DATA RETRIEVAL FLOW ---
  async function handleFormSubmit(e) {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    const destination = destinationInput.value.trim();
    if (!destination) return;

    const duration = parseInt(durationSelect.value);

    // Show loading screen and execute progress animations
    showScreen("loading");
    await runLoaderProgress();

    const customBudgetVal = document.getElementById("custom-budget-val");
    const budgetToSend = selectedBudget === "Custom" 
      ? ((customBudgetVal ? customBudgetVal.value.trim() : "") || "Standard")
      : selectedBudget;

    try {
      if (geminiAPI.hasApiKey()) {
        // Retrieve Live Itinerary via Gemini API
        currentPlan = await geminiAPI.generatePlan(destination, duration, budgetToSend, selectedStyle);
        sourceBadge.querySelector("span").textContent = "AI Live Generated";
        sourceBadge.className = "mode-badge"; // Green success style by default
      } else {
        // Demo mode (Mock Data)
        const mockKey = destination.toLowerCase().replace(" city", "");
        let planTemplate = null;

        // Try exact match or submatch
        for (const key of Object.keys(mockTravelPlans)) {
          if (mockKey.includes(key) || key.includes(mockKey)) {
            planTemplate = mockTravelPlans[key];
            break;
          }
        }

        if (planTemplate) {
          // Adapt template to requested duration
          currentPlan = adaptMockPlan(planTemplate, duration, budgetToSend, selectedStyle);
          sourceBadge.querySelector("span").textContent = "Pre-Loaded Demo";
          sourceBadge.className = "mode-badge";
        } else {
          // No API key and city not in presets
          throw new Error("No API key provided. VoyageAI can only plan trips to pre-loaded cities (Jaipur, Udaipur, Varanasi, Agra, Kochi, Manali, Tokyo, Kyoto, Paris, Rome, Florence, or New York) in offline demo mode. Set GEMINI_API_KEY on the server to search any custom location!");
        }
      }

      // Render details and load dashboard screen
      activeDay = 1;
      ensureCoordinates(currentPlan);
      renderDashboard();
      showScreen("dashboard");

    } catch (error) {
      console.warn("Gemini API call failed, attempting fallback:", error.message);
      
      // Check if requested destination has a matching offline mock plan template
      const mockKey = destination.toLowerCase().replace(" city", "");
      let planTemplate = null;

      for (const key of Object.keys(mockTravelPlans)) {
        if (mockKey.includes(key) || key.includes(mockKey)) {
          planTemplate = mockTravelPlans[key];
          break;
        }
      }

      if (planTemplate) {
        try {
          // Adapt template to requested parameters
          currentPlan = adaptMockPlan(planTemplate, duration, budgetToSend, selectedStyle);
          ensureCoordinates(currentPlan);
          activeDay = 1;
          renderDashboard();
          showScreen("dashboard");
          
          // Modify source badge to explain fallback
          sourceBadge.querySelector("span").textContent = "Offline Fallback (Model Overload)";
          sourceBadge.className = "mode-badge warning-badge";
          
          showToast(
            "AI Model High Demand", 
            `VoyageAI fell back to the pre-loaded offline plan for ${destination} because the live servers are currently overloaded.`,
            "warning"
          );
          return;
        } catch (adaptError) {
          console.error("Failed to adapt mock plan:", adaptError);
        }
      }

      // No fallback possible
      showToast(
        "Live AI Overload", 
        `Live AI generation is experiencing high demand. Please try again in a moment, or plan an instant offline city (like Jaipur, Tokyo, Paris, Rome, etc.).`,
        "error"
      );
      showScreen("setup");
    }
  }

  // Simulates progress steps with realistic delays
  function runLoaderProgress() {
    return new Promise((resolve) => {
      let progress = 0;
      loadingProgress.style.width = "0%";
      
      const steps = [
        { limit: 25, title: "Locating coordinates...", status: "Finding nearby spots and hotels..." },
        { limit: 55, title: "Analyzing spots...", status: "Curating sights based on style and companion..." },
        { limit: 80, title: "Connecting routes...", status: "Plotting public transit and taxi travel paths..." },
        { limit: 100, title: "Formatting itinerary...", status: "Applying HSL color mappings..." }
      ];

      let currentStepIdx = 0;
      
      const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 8) + 4;
        
        if (progress >= 100) {
          progress = 100;
          loadingProgress.style.width = "100%";
          clearInterval(interval);
          setTimeout(resolve, 300);
        }

        loadingProgress.style.width = `${progress}%`;

        // Update status text
        const step = steps[currentStepIdx];
        if (step && progress >= step.limit) {
          loadingTitle.textContent = step.title;
          loadingStatus.textContent = step.status;
          currentStepIdx++;
        }
      }, 120);
    });
  }

  // Modifies preloaded templates if user changes duration/style/budget
  function adaptMockPlan(template, duration, budget, style) {
    // Clone template deeply
    const plan = JSON.parse(JSON.stringify(template));
    plan.duration = duration;
    plan.budget = budget;
    plan.style = style;
    
    // Filter/pad itinerary days if duration differs from template duration
    if (plan.itinerary && plan.itinerary.length > 0) {
      if (plan.itinerary.length >= duration) {
        plan.itinerary = plan.itinerary.slice(0, duration);
      } else {
        const origLength = plan.itinerary.length;
        for (let i = origLength; i < duration; i++) {
          const clonedDay = JSON.parse(JSON.stringify(plan.itinerary[i % origLength]));
          clonedDay.day = i + 1;
          plan.itinerary.push(clonedDay);
        }
      }
    }
    
    // Adjust Daily costs depending on budget class
    if (budget === "Budget") {
      plan.overview.daily_cost = plan.overview.daily_cost.replace(/[\d,]+/g, (m) => {
        const val = parseInt(m.replace(/,/g, ''));
        return Math.round(val * 0.5).toLocaleString();
      });
      plan.hotels = plan.hotels[1] ? [plan.hotels[1]] : (plan.hotels[0] ? [plan.hotels[0]] : []);
    } else if (budget === "Luxury") {
      plan.overview.daily_cost = plan.overview.daily_cost.replace(/[\d,]+/g, (m) => {
        const val = parseInt(m.replace(/,/g, ''));
        return Math.round(val * 4).toLocaleString();
      });
      plan.hotels = plan.hotels[2] ? [plan.hotels[2]] : (plan.hotels[0] ? [plan.hotels[0]] : []);
    } else {
      plan.hotels = plan.hotels[0] ? [plan.hotels[0]] : [];
    }
    
    return plan;
  }

  // --- RENDER FUNCTIONS ---
  function renderDashboard() {
    if (!currentPlan) return;

    // Header Content
    heroDestination.textContent = currentPlan.destination;
    heroDescription.textContent = currentPlan.description;
    heroStyleBadge.textContent = currentPlan.style;
    heroBudgetBadge.textContent = `${currentPlan.budget} Budget`;

    // Dynamically set background image for Dashboard Hero Banner and Body Background
    const heroImgUrl = getValidImage(currentPlan.hero_image, currentPlan.destination);
    const dashboardHero = document.querySelector(".dashboard-hero");
    if (dashboardHero) {
      dashboardHero.style.backgroundImage = `url('${heroImgUrl}')`;
    }
    document.body.style.setProperty('--body-bg-image', `url('${heroImgUrl}')`);

    // Overview Stats
    statWeather.textContent = currentPlan.overview.weather;
    statCost.textContent = currentPlan.overview.daily_cost;
    statDays.textContent = `${currentPlan.duration} Day(s)`;

    // Travel Tips
    travelTipsText.textContent = currentPlan.overview.tips || "Purchase local day passes for trains. Stay hydrated during walks.";

    // Stays
    hotelList.innerHTML = "";
    currentPlan.hotels.forEach(hotel => {
      const hotelImgUrl = getValidImage(hotel.image, hotel.name + " " + (hotel.address || "hotel"));
      const div = document.createElement("div");
      div.className = "hotel-item";
      div.innerHTML = `
        <div class="hotel-card-image-wrap">
          <img class="hotel-card-image" src="${hotelImgUrl}" alt="${hotel.name}" onerror="this.src='https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80'">
        </div>
        <div class="hotel-card-info-wrap">
          <div class="hotel-meta">
            <span class="hotel-name">${hotel.name}</span>
            <span class="hotel-price">${hotel.price}</span>
          </div>
          <div class="hotel-rating"><i class="fa-solid fa-star"></i> ${hotel.rating} Rating</div>
          <div class="hotel-address"><i class="fa-solid fa-map-pin"></i> ${hotel.address}</div>
          <p class="hotel-desc">${hotel.highlight}</p>
        </div>
      `;
      hotelList.appendChild(div);
    });

    // Attractions list
    spotsList.innerHTML = "";
    currentPlan.spots.forEach(spot => {
      const spotImgUrl = getValidImage(spot.image, spot.name + " " + spot.category);
      const div = document.createElement("div");
      div.className = "spot-badge-card";
      div.innerHTML = `
        <div class="spot-card-image-wrap">
          <img class="spot-card-image" src="${spotImgUrl}" alt="${spot.name}" onerror="this.src='https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80'">
        </div>
        <div class="spot-card-info-wrap">
          <div class="spot-badge-info">
            <span class="spot-badge-name">${spot.name}</span>
            <span class="spot-badge-desc">${spot.highlight}</span>
          </div>
          <div class="spot-badge-meta">
            <span class="spot-category-label">${spot.category}</span>
            <span class="spot-rating-label"><i class="fa-solid fa-star"></i> ${spot.rating}</span>
          </div>
        </div>
      `;
      spotsList.appendChild(div);
    });

    // Populate day tabs selector
    dayTabsContainer.innerHTML = "";
    for (let d = 1; d <= currentPlan.duration; d++) {
      const btn = document.createElement("button");
      btn.className = `day-tab-btn ${d === activeDay ? "active" : ""}`;
      btn.textContent = `Day ${d}`;
      btn.addEventListener("click", () => {
        document.querySelectorAll(".day-tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeDay = d;
        renderActiveDayItinerary();
      });
      dayTabsContainer.appendChild(btn);
    }

    // Render itinerary elements for active day
    renderActiveDayItinerary();
  }

  function renderActiveDayItinerary() {
    timelineEvents.innerHTML = "";
    
    // Find itinerary details for active day
    const dayPlan = currentPlan.itinerary.find(item => item.day === activeDay);
    if (!dayPlan) return;

    dayPlan.schedule.forEach((sched, index) => {
      // 1. Add transit step preceding the spot if it's not the first spot
      if (index > 0 && sched.transport) {
        const divider = document.createElement("div");
        divider.className = "transport-divider";
        divider.innerHTML = `
          <i class="fa-solid fa-arrows-left-right-to-line"></i>
          <span class="transport-line"></span>
          <span>${sched.transport}</span>
          <span class="transport-line"></span>
        `;
        timelineEvents.appendChild(divider);
      }

      // 2. Add main spot timeline item
      const spotImgUrl = getValidImage(sched.image, sched.spot);
      
      // Look up additional spot details from spots list or hotels list to provide visual assistance and info
      const spotDetails = (currentPlan.spots && currentPlan.spots.find(s => s.name.toLowerCase().includes(sched.spot.toLowerCase()) || sched.spot.toLowerCase().includes(s.name.toLowerCase())))
                       || (currentPlan.hotels && currentPlan.hotels.find(h => h.name.toLowerCase().includes(sched.spot.toLowerCase()) || sched.spot.toLowerCase().includes(h.name.toLowerCase())));
      
      let extraInfoHtml = '';
      if (spotDetails) {
        const rating = spotDetails.rating ? `<span class="spot-rating-label" style="font-size: 0.8rem; color: var(--warning);"><i class="fa-solid fa-star"></i> ${spotDetails.rating} Rating</span>` : '';
        const cat = spotDetails.category ? `<span class="spot-category-label" style="font-size: 0.7rem; text-transform: uppercase; background: rgba(255, 255, 255, 0.08); padding: 2px 6px; border-radius: 4px; color: var(--text-secondary);">${spotDetails.category}</span>` : '';
        const highlight = spotDetails.highlight ? `<p class="spot-extra-highlight" style="font-size: 0.85rem; color: var(--text-muted); font-style: italic; margin-top: 4px; margin-bottom: 8px;">"${spotDetails.highlight}"</p>` : '';
        
        extraInfoHtml = `
          <div class="spot-extra-info" style="display: flex; gap: 8px; align-items: center; margin-top: 6px; margin-bottom: 6px;">
            ${cat}
            ${rating}
          </div>
          ${highlight}
        `;
      }

      const item = document.createElement("div");
      item.className = "timeline-item";
      item.innerHTML = `
        <div class="timeline-card">
          <div class="timeline-card-image-wrap">
            <img class="timeline-card-image" src="${spotImgUrl}" alt="${sched.spot}" onerror="this.src='https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80'">
          </div>
          <div class="timeline-card-content">
            <div class="timeline-meta">
              <span class="time-slot">${sched.time}</span>
              <span class="spot-cost">Cost: ${sched.cost}</span>
            </div>
            <h4>${sched.spot}</h4>
            ${extraInfoHtml}
            <p>${sched.activity}</p>
            <div class="card-metrics">
              <span><i class="fa-regular fa-clock"></i> Duration: ${sched.duration}</span>
            </div>
          </div>
        </div>
      `;
      timelineEvents.appendChild(item);
    });

    // Draw route map on canvas
    drawRouteMap(dayPlan.schedule);

    // List route directions details
    renderRouteDetails(dayPlan.schedule);
  }

  function renderRouteDetails(schedule) {
    routeDetails.innerHTML = "";
    
    if (currentPlan.routes && currentPlan.routes.length > 0) {
      // If we have custom computed routes from API, display them
      currentPlan.routes.forEach(route => {
        const step = document.createElement("div");
        step.className = "route-step";
        step.innerHTML = `
          <span class="route-step-text"><strong>${route.from}</strong> to <strong>${route.to}</strong></span>
          <span class="route-step-modes">
            <i class="fa-solid fa-taxi"></i> ${route.modes.join(" / ")} (${route.duration}, ${route.distance})
          </span>
        `;
        routeDetails.appendChild(step);
      });
    } else {
      // Fallback: draw sequential route hops from schedule
      for (let i = 0; i < schedule.length - 1; i++) {
        const step = document.createElement("div");
        step.className = "route-step";
        const trans = schedule[i+1].transport || "Transit 10 mins";
        step.innerHTML = `
          <span class="route-step-text"><strong>${schedule[i].spot}</strong> to <strong>${schedule[i+1].spot}</strong></span>
          <span class="route-step-modes">
            <i class="fa-solid fa-route"></i> ${trans}
          </span>
        `;
        routeDetails.appendChild(step);
      }
    }
  }

  // --- LEAFLET INTERACTIVE MAP DRAWING ---
  function drawRouteMap(schedule) {
    // 1. Clean up old map instances to prevent container initialization error
    if (window.routeMap) {
      window.routeMap.remove();
      window.routeMap = null;
    }

    if (!schedule || schedule.length === 0) return;

    // 2. Fetch hotel coordinate
    const hotel = currentPlan.hotels[0];
    const hotelLat = hotel ? hotel.latitude : schedule[0].latitude;
    const hotelLng = hotel ? hotel.longitude : schedule[0].longitude;
    const hotelName = hotel ? hotel.name : "Hotel Base";

    // 3. Initialize Leaflet Map
    window.routeMap = L.map('route-map', {
      zoomControl: true,
      scrollWheelZoom: false // disable scroll zoom to prevent interference while scrolling page
    }).setView([hotelLat, hotelLng], 13);

    // 4. Load CartoDB Dark Matter tiles for premium appearance
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(window.routeMap);

    const markersGroup = [];

    // 5. Draw Hotel base pin (Green marker)
    const hotelIcon = L.divIcon({
      html: `<div class="custom-map-marker hotel-marker" style="width: 24px; height: 24px; line-height: 20px;"><i class="fa-solid fa-hotel"></i></div>`,
      className: '',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    
    L.marker([hotelLat, hotelLng], { icon: hotelIcon })
      .bindPopup(`<h4>${hotelName}</h4><p>${hotel ? hotel.address : "Stay Base"}</p>`)
      .addTo(window.routeMap);
      
    markersGroup.push([hotelLat, hotelLng]);

    // 6. Draw Attraction pins and route links
    const routeCoords = [[hotelLat, hotelLng]];

    schedule.forEach((sched, index) => {
      const spotLat = sched.latitude;
      const spotLng = sched.longitude;
      
      routeCoords.push([spotLat, spotLng]);
      markersGroup.push([spotLat, spotLng]);

      const spotIcon = L.divIcon({
        html: `<div class="custom-map-marker" style="width: 22px; height: 22px; line-height: 18px;">${index + 1}</div>`,
        className: '',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      L.marker([spotLat, spotLng], { icon: spotIcon })
        .bindPopup(`<h4>${sched.spot}</h4><p><strong>${sched.time}</strong><br>${sched.activity}</p>`)
        .addTo(window.routeMap);
    });

    // Connect back to hotel at the end of the day
    routeCoords.push([hotelLat, hotelLng]);

    // 7. Draw routing lines
    L.polyline(routeCoords, {
      color: 'var(--primary)',
      weight: 3,
      opacity: 0.8,
      dashArray: '6, 6'
    }).addTo(window.routeMap);

    // 8. Auto-adjust map bounds to encapsulate all pins nicely
    if (markersGroup.length > 0) {
      const bounds = L.latLngBounds(markersGroup);
      window.routeMap.fitBounds(bounds, { padding: [30, 30] });
    }
  }

  // --- AUTHENTICATION & SAVE TRIP ACTIONS ---
  async function checkLoginState() {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        if (data.logged_in) {
          currentUser = data.user;
          userDisplayName.textContent = currentUser.name;
          btnLoginTrigger.style.display = "none";
          userProfileMenu.style.display = "flex";
          btnSaveTrip.style.display = "inline-flex";
        } else {
          currentUser = null;
          btnLoginTrigger.style.display = "inline-block";
          userProfileMenu.style.display = "none";
        }
      }
    } catch (e) {
      console.error("Failed to check auth state", e);
    }
  }

  function openAuthModal() {
    loginErrorMessage.style.display = "none";
    registerErrorMessage.style.display = "none";
    registerSuccessMessage.style.display = "none";
    loginForm.reset();
    registerForm.reset();
    switchAuthTab("login");
    openModal(authModal);
  }

  function switchAuthTab(tab) {
    if (tab === "login") {
      tabLogin.classList.add("active");
      tabRegister.classList.remove("active");
      loginForm.classList.add("active");
      registerForm.classList.remove("active");
    } else {
      tabLogin.classList.remove("active");
      tabRegister.classList.add("active");
      loginForm.classList.remove("active");
      registerForm.classList.add("active");
    }
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    loginErrorMessage.style.display = "none";
    
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;
    
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      
      if (response.ok) {
        closeModal(authModal);
        await checkLoginState();
      } else {
        let errorText = "Invalid username or password";
        try {
          const data = await response.json();
          errorText = data.error || errorText;
        } catch (jsonErr) {
          errorText = `Server error (${response.status}).`;
        }
        loginErrorMessage.querySelector("span").textContent = errorText;
        loginErrorMessage.style.display = "flex";
      }
    } catch (err) {
      let msg = "Connection error. Ensure server.py is running on http://127.0.0.1:5000";
      if (window.location.protocol === "file:") {
        msg = "You are browsing via local file. Use http://127.0.0.1:5000 in your address bar.";
      }
      loginErrorMessage.querySelector("span").textContent = msg;
      loginErrorMessage.style.display = "flex";
    }
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    registerErrorMessage.style.display = "none";
    registerSuccessMessage.style.display = "none";
    
    const name = document.getElementById("register-name").value;
    const username = document.getElementById("register-username").value;
    const password = document.getElementById("register-password").value;
    
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, password })
      });
      
      if (response.ok) {
        registerSuccessMessage.style.display = "flex";
        registerForm.reset();
        setTimeout(() => switchAuthTab("login"), 1500);
      } else {
        let errorText = "Registration failed.";
        try {
          const data = await response.json();
          errorText = data.error || errorText;
        } catch (jsonErr) {
          errorText = `Server error (${response.status}).`;
        }
        registerErrorMessage.querySelector("span").textContent = errorText;
        registerErrorMessage.style.display = "flex";
      }
    } catch (err) {
      let msg = "Connection error. Ensure server.py is running on http://127.0.0.1:5000";
      if (window.location.protocol === "file:") {
        msg = "You are browsing via local file. Use http://127.0.0.1:5000 in your address bar.";
      }
      registerErrorMessage.querySelector("span").textContent = msg;
      registerErrorMessage.style.display = "flex";
    }
  }

  async function handleLogout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (response.ok) {
        currentUser = null;
        btnLoginTrigger.style.display = "inline-block";
        userProfileMenu.style.display = "none";
      }
    } catch (e) {
      console.error("Failed to logout", e);
    }
  }

  async function handleSaveTrip() {
    if (!currentUser) {
      openAuthModal();
      return;
    }
    if (!currentPlan) return;
    
    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: currentPlan.destination,
          duration: currentPlan.duration,
          budget: currentPlan.budget,
          style: currentPlan.style,
          itinerary_data: currentPlan
        })
      });
      
      if (response.ok) {
        // Change button state temporarily to success
        const originalHtml = btnSaveTrip.innerHTML;
        btnSaveTrip.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span>Saved!</span>';
        btnSaveTrip.classList.add("saved");
        
        setTimeout(() => {
          btnSaveTrip.innerHTML = originalHtml;
          btnSaveTrip.classList.remove("saved");
        }, 3000);
      } else {
        const data = await response.json();
        alert("Failed to save trip: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      alert("Error contacting local server. Ensure server.py is running!");
    }
  }

  function openTripsModal() {
    currentBudgetFilter = "All";
    currentSearchQuery = "";
    const modalSearchInput = document.getElementById("modal-search-input");
    if (modalSearchInput) modalSearchInput.value = "";
    const modalBudgetFilter = document.getElementById("modal-budget-filter");
    if (modalBudgetFilter) {
      const chips = modalBudgetFilter.querySelectorAll(".chip");
      chips.forEach(c => {
        if (c.getAttribute("data-filter") === "All") {
          c.classList.add("active");
        } else {
          c.classList.remove("active");
        }
      });
    }
    loadSavedTripsList();
    openModal(tripsModal);
  }

  async function loadSavedTripsList() {
    tripsListContainer.innerHTML = '<div class="trips-empty-state"><i class="fa-solid fa-spinner fa-spin"></i><p>Loading your adventures...</p></div>';
    
    try {
      const response = await fetch("/api/trips");
      if (response.ok) {
        const data = await response.json();
        savedTrips = data.trips || [];
        renderFilteredTrips();
      } else {
        tripsListContainer.innerHTML = '<div class="trips-empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Failed to retrieve saved trips.</p></div>';
      }
    } catch (e) {
      tripsListContainer.innerHTML = '<div class="trips-empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Connection error. Is server.py active?</p></div>';
    }
  }

  function renderFilteredTrips() {
    const filtered = savedTrips.filter(trip => {
      const matchesBudget = currentBudgetFilter === "All" || trip.budget.toLowerCase() === currentBudgetFilter.toLowerCase();
      const matchesSearch = !currentSearchQuery || trip.destination.toLowerCase().includes(currentSearchQuery.toLowerCase());
      return matchesBudget && matchesSearch;
    });

    if (filtered.length === 0) {
      tripsListContainer.innerHTML = `
        <div class="trips-empty-state">
          <i class="fa-solid fa-map-location-dot"></i>
          <p>No matching saved trips found.</p>
        </div>
      `;
      return;
    }

    tripsListContainer.innerHTML = "";
    filtered.forEach(trip => {
      const item = document.createElement("div");
      item.className = "trip-list-item";
      
      const formattedDate = new Date(trip.created_at).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      
      item.innerHTML = `
        <div class="trip-info">
          <span class="trip-destination">${trip.destination}</span>
          <div class="trip-meta">
            <span class="trip-tag">${trip.duration} Day(s)</span>
            <span class="trip-tag budget-tag">${trip.budget}</span>
            <span class="trip-tag style-tag">${trip.style}</span>
          </div>
          <span class="trip-date"><i class="fa-regular fa-clock"></i> Saved: ${formattedDate}</span>
        </div>
        <div class="trip-actions">
          <button class="primary-button btn-load-trip" data-id="${trip.id}">Load</button>
          <button class="secondary-button danger-text btn-delete-trip" data-id="${trip.id}"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      `;
      
      // Bind button events
      item.querySelector(".btn-load-trip").addEventListener("click", () => {
        currentPlan = trip.itinerary_data;
        ensureCoordinates(currentPlan);
        activeDay = 1;
        renderDashboard();
        showScreen("dashboard");
        closeModal(tripsModal);
      });
      
      item.querySelector(".btn-delete-trip").addEventListener("click", async () => {
        if (confirm(`Are you sure you want to delete your trip to ${trip.destination}?`)) {
          await deleteSavedTrip(trip.id);
        }
      });
      
      tripsListContainer.appendChild(item);
    });
  }

  async function deleteSavedTrip(tripId) {
    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: "DELETE"
      });
      if (response.ok) {
        await loadSavedTripsList();
      } else {
        const data = await response.json();
        alert("Failed to delete trip: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      alert("Error communicating with server.");
    }
  }

  // --- IMAGE MAPPING HELPER FUNCTION ---
  const genericPlaceholders = [
    "1566073771259", // luxury pool
    "1507525428034", // sunset beach
    "1464822759023", // mountain range
    "1542044896530", // temple carving
    "1555854877",     // hostel bunk beds
    "1590490360182"  // hotel room interior
  ];

  function getValidImage(url, fallbackQuery) {
    if (!url) return getPhotoUrlForLocation(fallbackQuery);
    const isGeneric = genericPlaceholders.some(p => url.includes(p));
    return isGeneric ? getPhotoUrlForLocation(fallbackQuery) : url;
  }

  function getPhotoUrlForLocation(query) {
    if (!query) return "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80";
    const lowerQuery = query.toLowerCase().trim();

    // 1. Landmark Mappings
    const landmarkPhotos = {
      // ---- JAIPUR ---- Hotels, Spots & Every Itinerary Location
      "umaid bhawan": "https://images.unsplash.com/photo-1585135497273-1a86b09fe707?auto=format&fit=crop&w=600&q=80",
      "pearl palace": "https://images.unsplash.com/photo-1598977123418-45f04b01f4ac?auto=format&fit=crop&w=600&q=80",
      "oberoi rajvilas": "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=600&q=80",
      "hawa mahal": "https://images.unsplash.com/photo-1603262110263-fb0112e7cc33?auto=format&fit=crop&w=600&q=80",
      "palace of winds": "https://images.unsplash.com/photo-1603262110263-fb0112e7cc33?auto=format&fit=crop&w=600&q=80",
      "amber palace": "https://images.unsplash.com/photo-1590050752117-238cb0612b1b?auto=format&fit=crop&w=600&q=80",
      "amer fort": "https://images.unsplash.com/photo-1590050752117-238cb0612b1b?auto=format&fit=crop&w=600&q=80",
      "sheesh mahal": "https://images.unsplash.com/photo-1590050752117-238cb0612b1b?auto=format&fit=crop&w=600&q=80",
      "city palace jaipur": "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=600&q=80",
      "jantar mantar": "https://images.unsplash.com/photo-1598103328574-d4b3eb03a586?auto=format&fit=crop&w=600&q=80",
      "bapu bazaar": "https://images.unsplash.com/photo-1561543226663-1fb55c61c2e2?auto=format&fit=crop&w=600&q=80",
      "johari bazaar": "https://images.unsplash.com/photo-1561543226663-1fb55c61c2e2?auto=format&fit=crop&w=600&q=80",
      "panna meena kund": "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=600&q=80",
      "panna meena": "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=600&q=80",
      "nahargarh": "https://images.unsplash.com/photo-1614082242765-7c99bc013511?auto=format&fit=crop&w=600&q=80",
      "albert hall museum": "https://images.unsplash.com/photo-1572508589584-94d778209eb9?auto=format&fit=crop&w=600&q=80",
      "albert hall": "https://images.unsplash.com/photo-1572508589584-94d778209eb9?auto=format&fit=crop&w=600&q=80",
      "galta ji": "https://images.unsplash.com/photo-1597211684565-dab0db822fa2?auto=format&fit=crop&w=600&q=80",
      "monkey temple": "https://images.unsplash.com/photo-1597211684565-dab0db822fa2?auto=format&fit=crop&w=600&q=80",
      "chokhi dhani": "https://images.unsplash.com/photo-1618083707368-b3823daa2726?auto=format&fit=crop&w=600&q=80",

      // ---- TOKYO ---- Hotels, Spots & Every Itinerary Location
      "shibuya crossing": "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80",
      "shibuya sky": "https://images.unsplash.com/photo-1531979089527-04720c29fb3b?auto=format&fit=crop&w=600&q=80",
      "hachiko": "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80",
      "senso-ji": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80",
      "sensoji": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80",
      "asakusa": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80",
      "kaminarimon": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80",
      "nakamise": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80",
      "meiji jingu": "https://images.unsplash.com/photo-1570171278960-d6c2b316f3b1?auto=format&fit=crop&w=600&q=80",
      "meiji shrine": "https://images.unsplash.com/photo-1570171278960-d6c2b316f3b1?auto=format&fit=crop&w=600&q=80",
      "harajuku": "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=600&q=80",
      "takeshita": "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=600&q=80",
      "shinjuku gyoen": "https://images.unsplash.com/photo-1570171278960-d6c2b316f3b1?auto=format&fit=crop&w=600&q=80",
      "tokyo skytree": "https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?auto=format&fit=crop&w=600&q=80",
      "tokyo tower": "https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?auto=format&fit=crop&w=600&q=80",
      "akihabara": "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80",
      "tsukiji": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80",
      "teamlab": "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80",
      "omoide yokocho": "https://images.unsplash.com/photo-1535303311164-664fc9ec6532?auto=format&fit=crop&w=600&q=80",
      "memory lane": "https://images.unsplash.com/photo-1535303311164-664fc9ec6532?auto=format&fit=crop&w=600&q=80",
      "yakitori": "https://images.unsplash.com/photo-1535303311164-664fc9ec6532?auto=format&fit=crop&w=600&q=80",
      "odaiba": "https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?auto=format&fit=crop&w=600&q=80",
      "rainbow bridge": "https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?auto=format&fit=crop&w=600&q=80",
      "park hyatt tokyo": "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=600&q=80",
      "hotel gracery": "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=600&q=80",
      "apa hotel": "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=600&q=80",

      // ---- PARIS ---- Hotels, Spots & Every Itinerary Location
      "eiffel tower": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=600&q=80",
      "trocadero": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=600&q=80",
      "louvre": "https://images.unsplash.com/photo-1565008447742-97f6f38c985c?auto=format&fit=crop&w=600&q=80",
      "notre-dame": "https://images.unsplash.com/photo-1478860126073-1e35ff7c47f7?auto=format&fit=crop&w=600&q=80",
      "notre dame": "https://images.unsplash.com/photo-1478860126073-1e35ff7c47f7?auto=format&fit=crop&w=600&q=80",
      "arc de triomphe": "https://images.unsplash.com/photo-1509840144299-db975b209cc9?auto=format&fit=crop&w=600&q=80",
      "champs-elysees": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=600&q=80",
      "seine river": "https://images.unsplash.com/photo-1524338198850-8a2ff63a401f?auto=format&fit=crop&w=600&q=80",
      "seine cruise": "https://images.unsplash.com/photo-1524338198850-8a2ff63a401f?auto=format&fit=crop&w=600&q=80",
      "sacre-coeur": "https://images.unsplash.com/photo-1549646679-0524451737e9?auto=format&fit=crop&w=600&q=80",
      "sacre coeur": "https://images.unsplash.com/photo-1549646679-0524451737e9?auto=format&fit=crop&w=600&q=80",
      "montmartre": "https://images.unsplash.com/photo-1549646679-0524451737e9?auto=format&fit=crop&w=600&q=80",
      "place du tertre": "https://images.unsplash.com/photo-1549646679-0524451737e9?auto=format&fit=crop&w=600&q=80",
      "versailles": "https://images.unsplash.com/photo-1508193638397-1c4234db14d8?auto=format&fit=crop&w=600&q=80",
      "hall of mirrors": "https://images.unsplash.com/photo-1508193638397-1c4234db14d8?auto=format&fit=crop&w=600&q=80",
      "musee d'orsay": "https://images.unsplash.com/photo-1543429776-2782fc8e3c02?auto=format&fit=crop&w=600&q=80",
      "tuileries": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=600&q=80",
      "place de la concorde": "https://images.unsplash.com/photo-1509840144299-db975b209cc9?auto=format&fit=crop&w=600&q=80",
      "latin quarter": "https://images.unsplash.com/photo-1520939817895-060bdaf4fe1b?auto=format&fit=crop&w=600&q=80",
      "shakespeare": "https://images.unsplash.com/photo-1520939817895-060bdaf4fe1b?auto=format&fit=crop&w=600&q=80",
      "saint-germain": "https://images.unsplash.com/photo-1520939817895-060bdaf4fe1b?auto=format&fit=crop&w=600&q=80",
      "le marais": "https://images.unsplash.com/photo-1520939817895-060bdaf4fe1b?auto=format&fit=crop&w=600&q=80",
      "french wine": "https://images.unsplash.com/photo-1474722883778-792e7fb1f2d0?auto=format&fit=crop&w=600&q=80",
      "wine cave": "https://images.unsplash.com/photo-1474722883778-792e7fb1f2d0?auto=format&fit=crop&w=600&q=80",
      "hotel plaza athenee": "https://images.unsplash.com/photo-1499856138863-7a3b63a29b87?auto=format&fit=crop&w=600&q=80",
      "hotel caron de beaumarchais": "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=600&q=80",
      "generator paris": "https://images.unsplash.com/photo-1578469550956-0e16b69c6a3d?auto=format&fit=crop&w=600&q=80",

      // ---- ROME ---- Hotels, Spots & Every Itinerary Location
      "colosseum": "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=600&q=80",
      "roman forum": "https://images.unsplash.com/photo-1529299858697-fa1834d61bca?auto=format&fit=crop&w=600&q=80",
      "vatican": "https://images.unsplash.com/photo-1531572753322-ad063cecc140?auto=format&fit=crop&w=600&q=80",
      "st. peter": "https://images.unsplash.com/photo-1531572753322-ad063cecc140?auto=format&fit=crop&w=600&q=80",
      "sistine chapel": "https://images.unsplash.com/photo-1593085512500-5d55148d6f0d?auto=format&fit=crop&w=600&q=80",
      "trevi fountain": "https://images.unsplash.com/photo-1529260830199-44588102212c?auto=format&fit=crop&w=600&q=80",
      "trevi": "https://images.unsplash.com/photo-1529260830199-44588102212c?auto=format&fit=crop&w=600&q=80",
      "spanish steps": "https://images.unsplash.com/photo-1555992828-ca4dbe41d294?auto=format&fit=crop&w=600&q=80",
      "pantheon": "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=600&q=80",
      "piazza navona": "https://images.unsplash.com/photo-1555992828-ca4dbe41d294?auto=format&fit=crop&w=600&q=80",
      "castel sant'angelo": "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=600&q=80",
      "trastevere": "https://images.unsplash.com/photo-1555992828-ca4dbe41d294?auto=format&fit=crop&w=600&q=80",
      "monti district": "https://images.unsplash.com/photo-1529299858697-fa1834d61bca?auto=format&fit=crop&w=600&q=80",
      "campo de' fiori": "https://images.unsplash.com/photo-1529299858697-fa1834d61bca?auto=format&fit=crop&w=600&q=80",
      "pieta": "https://images.unsplash.com/photo-1531572753322-ad063cecc140?auto=format&fit=crop&w=600&q=80",
      "hotel santa maria": "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=600&q=80",
      "singer palace": "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80",
      "the beehive": "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=600&q=80",

      // ---- NEW YORK ---- Hotels, Spots & Every Itinerary Location
      "times square": "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=600&q=80",
      "central park": "https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=600&q=80",
      "bethesda fountain": "https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=600&q=80",
      "bow bridge": "https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=600&q=80",
      "strawberry fields": "https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=600&q=80",
      "empire state building": "https://images.unsplash.com/photo-1522083165195-342750297f95?auto=format&fit=crop&w=600&q=80",
      "empire state": "https://images.unsplash.com/photo-1522083165195-342750297f95?auto=format&fit=crop&w=600&q=80",
      "statue of liberty": "https://images.unsplash.com/photo-1508849789987-4e5333c12b78?auto=format&fit=crop&w=600&q=80",
      "liberty island": "https://images.unsplash.com/photo-1508849789987-4e5333c12b78?auto=format&fit=crop&w=600&q=80",
      "ellis island": "https://images.unsplash.com/photo-1508849789987-4e5333c12b78?auto=format&fit=crop&w=600&q=80",
      "battery park": "https://images.unsplash.com/photo-1508849789987-4e5333c12b78?auto=format&fit=crop&w=600&q=80",
      "brooklyn bridge": "https://images.unsplash.com/photo-1565363887715-2eb0ef1c4326?auto=format&fit=crop&w=600&q=80",
      "dumbo": "https://images.unsplash.com/photo-1565363887715-2eb0ef1c4326?auto=format&fit=crop&w=600&q=80",
      "brooklyn heights": "https://images.unsplash.com/photo-1565363887715-2eb0ef1c4326?auto=format&fit=crop&w=600&q=80",
      "9/11 memorial": "https://images.unsplash.com/photo-1553095066-5014bc7b7f2d?auto=format&fit=crop&w=600&q=80",
      "financial district": "https://images.unsplash.com/photo-1553095066-5014bc7b7f2d?auto=format&fit=crop&w=600&q=80",
      "wall street": "https://images.unsplash.com/photo-1553095066-5014bc7b7f2d?auto=format&fit=crop&w=600&q=80",
      "moma": "https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=600&q=80",
      "museum of modern art": "https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=600&q=80",
      "summit one vanderbilt": "https://images.unsplash.com/photo-1422640805998-18a4851d2a8e?auto=format&fit=crop&w=600&q=80",
      "grand central": "https://images.unsplash.com/photo-1422640805998-18a4851d2a8e?auto=format&fit=crop&w=600&q=80",
      "high line": "https://images.unsplash.com/photo-1516244498305-64906b9b3e1f?auto=format&fit=crop&w=600&q=80",
      "chelsea market": "https://images.unsplash.com/photo-1516244498305-64906b9b3e1f?auto=format&fit=crop&w=600&q=80",
      "plaza hotel": "https://images.unsplash.com/photo-1583037189850-1921ae7c6c22?auto=format&fit=crop&w=600&q=80",
      "freehand new york": "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80",
      "freehand": "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80",
      "pod 39": "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=600&q=80",

      // ---- UDAIPUR ---- Hotels, Spots & Every Itinerary Location
      "taj lake palace": "https://images.unsplash.com/photo-1595658658481-d53d3f999875?auto=format&fit=crop&w=600&q=80",
      "lake palace": "https://images.unsplash.com/photo-1595658658481-d53d3f999875?auto=format&fit=crop&w=600&q=80",
      "jag mandir": "https://images.unsplash.com/photo-1595658658481-d53d3f999875?auto=format&fit=crop&w=600&q=80",
      "lake pichola hotel": "https://images.unsplash.com/photo-1562613531-dfab57a7d455?auto=format&fit=crop&w=600&q=80",
      "lake pichola": "https://images.unsplash.com/photo-1595658658481-d53d3f999875?auto=format&fit=crop&w=600&q=80",
      "pichola boat ride": "https://images.unsplash.com/photo-1595658658481-d53d3f999875?auto=format&fit=crop&w=600&q=80",
      "mewar castle hostel": "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=600&q=80",
      "mewar castle": "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=600&q=80",
      "city palace udaipur": "https://images.unsplash.com/photo-1562613531-dfab57a7d455?auto=format&fit=crop&w=600&q=80",
      "sajjangarh monsoon": "https://images.unsplash.com/photo-1534430480872-3498386e7856?auto=format&fit=crop&w=600&q=80",
      "sajjangarh": "https://images.unsplash.com/photo-1534430480872-3498386e7856?auto=format&fit=crop&w=600&q=80",
      "monsoon palace": "https://images.unsplash.com/photo-1534430480872-3498386e7856?auto=format&fit=crop&w=600&q=80",
      "saheliyon-ki-bari": "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=600&q=80",
      "saheliyon": "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=600&q=80",
      "bagore ki haveli": "https://images.unsplash.com/photo-1562613531-dfab57a7d455?auto=format&fit=crop&w=600&q=80",
      "rajasthani dance": "https://images.unsplash.com/photo-1618083707368-b3823daa2726?auto=format&fit=crop&w=600&q=80",
      "eklingji": "https://images.unsplash.com/photo-1597211684565-dab0db822fa2?auto=format&fit=crop&w=600&q=80",
      "shilpgram": "https://images.unsplash.com/photo-1618083707368-b3823daa2726?auto=format&fit=crop&w=600&q=80",
      "ambrai ghat": "https://images.unsplash.com/photo-1595658658481-d53d3f999875?auto=format&fit=crop&w=600&q=80",
      "jagdish temple": "https://images.unsplash.com/photo-1624968854877-5d4e04db6bde?auto=format&fit=crop&w=600&q=80",

      // ---- VARANASI ---- Hotels, Spots & Every Itinerary Location
      "brijrama palace": "https://images.unsplash.com/photo-1543968332-f99478b1ebdc?auto=format&fit=crop&w=600&q=80",
      "alka hotel": "https://images.unsplash.com/photo-1561361531-997c5e23d508?auto=format&fit=crop&w=600&q=80",
      "bunkedup hostel": "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=600&q=80",
      "bunkedup": "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=600&q=80",
      "kashi vishwanath": "https://images.unsplash.com/photo-1621609764180-2ca554a9d6f2?auto=format&fit=crop&w=600&q=80",
      "dashashwamedh ghat": "https://images.unsplash.com/photo-1561361531-997c5e23d508?auto=format&fit=crop&w=600&q=80",
      "dashashwamedh": "https://images.unsplash.com/photo-1561361531-997c5e23d508?auto=format&fit=crop&w=600&q=80",
      "ganga aarti": "https://images.unsplash.com/photo-1561361531-997c5e23d508?auto=format&fit=crop&w=600&q=80",
      "sunrise boat ride": "https://images.unsplash.com/photo-1561361531-997c5e23d508?auto=format&fit=crop&w=600&q=80",
      "ganges": "https://images.unsplash.com/photo-1561361531-997c5e23d508?auto=format&fit=crop&w=600&q=80",
      "assi ghat": "https://images.unsplash.com/photo-1561361531-997c5e23d508?auto=format&fit=crop&w=600&q=80",
      "harishchandra ghat": "https://images.unsplash.com/photo-1561361531-997c5e23d508?auto=format&fit=crop&w=600&q=80",
      "ramnagar fort": "https://images.unsplash.com/photo-1568557060881-3bd9d4a47f3f?auto=format&fit=crop&w=600&q=80",
      "lalapura": "https://images.unsplash.com/photo-1561543226663-1fb55c61c2e2?auto=format&fit=crop&w=600&q=80",
      "banarasi silk": "https://images.unsplash.com/photo-1561543226663-1fb55c61c2e2?auto=format&fit=crop&w=600&q=80",
      "silk weaver": "https://images.unsplash.com/photo-1561543226663-1fb55c61c2e2?auto=format&fit=crop&w=600&q=80",
      "sarnath": "https://images.unsplash.com/photo-1617196034183-421b4040ed20?auto=format&fit=crop&w=600&q=80",
      "dhamekh stupa": "https://images.unsplash.com/photo-1617196034183-421b4040ed20?auto=format&fit=crop&w=600&q=80",
      "banaras hindu university": "https://images.unsplash.com/photo-1621609764180-2ca554a9d6f2?auto=format&fit=crop&w=600&q=80",

      // ---- AGRA ---- Hotels, Spots & Every Itinerary Location
      "taj mahal": "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=600&q=80",
      "taj mahal sunrise": "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=600&q=80",
      "agra fort": "https://images.unsplash.com/photo-1583077874340-79f3e9a80c26?auto=format&fit=crop&w=600&q=80",
      "mehtab bagh": "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=600&q=80",
      "moonlight garden": "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=600&q=80",
      "fatehpur sikri": "https://images.unsplash.com/photo-1587295656906-b2e7b5f5dcc9?auto=format&fit=crop&w=600&q=80",
      "buland darwaza": "https://images.unsplash.com/photo-1587295656906-b2e7b5f5dcc9?auto=format&fit=crop&w=600&q=80",
      "salim chishti": "https://images.unsplash.com/photo-1587295656906-b2e7b5f5dcc9?auto=format&fit=crop&w=600&q=80",
      "fatehpur": "https://images.unsplash.com/photo-1587295656906-b2e7b5f5dcc9?auto=format&fit=crop&w=600&q=80",
      "sikandra": "https://images.unsplash.com/photo-1583077874340-79f3e9a80c26?auto=format&fit=crop&w=600&q=80",
      "tomb of akbar": "https://images.unsplash.com/photo-1583077874340-79f3e9a80c26?auto=format&fit=crop&w=600&q=80",
      "itmad-ud-daulah": "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=600&q=80",
      "baby taj": "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=600&q=80",
      "sadar bazaar": "https://images.unsplash.com/photo-1561543226663-1fb55c61c2e2?auto=format&fit=crop&w=600&q=80",
      "marble inlay": "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=600&q=80",
      "taj nature walk": "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=600&q=80",
      "oberoi amarvilas": "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=600&q=80",
      "howard plaza": "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80",
      "zostel agra": "https://images.unsplash.com/photo-1568495248636-6432b97bd949?auto=format&fit=crop&w=600&q=80",

      // ---- KOCHI ---- Hotels, Spots & Every Itinerary Location
      "brunton boatyard": "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80",
      "eighth bastion": "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=600&q=80",
      "zostel fort kochi": "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=600&q=80",
      "chinese fishing nets": "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?auto=format&fit=crop&w=600&q=80",
      "chinese fishing": "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?auto=format&fit=crop&w=600&q=80",
      "fort kochi walk": "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?auto=format&fit=crop&w=600&q=80",
      "fort kochi beach": "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?auto=format&fit=crop&w=600&q=80",
      "mattancherry palace": "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=600&q=80",
      "dutch palace": "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=600&q=80",
      "mattancherry": "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=600&q=80",
      "jew town": "https://images.unsplash.com/photo-1594495894542-a46cc73e081a?auto=format&fit=crop&w=600&q=80",
      "paradesi synagogue": "https://images.unsplash.com/photo-1594495894542-a46cc73e081a?auto=format&fit=crop&w=600&q=80",
      "spice warehouse": "https://images.unsplash.com/photo-1594495894542-a46cc73e081a?auto=format&fit=crop&w=600&q=80",
      "st. francis church": "https://images.unsplash.com/photo-1601134467661-3d775b999c18?auto=format&fit=crop&w=600&q=80",
      "vasco da gama": "https://images.unsplash.com/photo-1601134467661-3d775b999c18?auto=format&fit=crop&w=600&q=80",
      "santa cruz basilica": "https://images.unsplash.com/photo-1601134467661-3d775b999c18?auto=format&fit=crop&w=600&q=80",
      "santa cruz": "https://images.unsplash.com/photo-1601134467661-3d775b999c18?auto=format&fit=crop&w=600&q=80",
      "kathakali dance": "https://images.unsplash.com/photo-1574786573225-e9c0c79a8ade?auto=format&fit=crop&w=600&q=80",
      "kathakali": "https://images.unsplash.com/photo-1574786573225-e9c0c79a8ade?auto=format&fit=crop&w=600&q=80",
      "alappuzha backwaters": "https://images.unsplash.com/photo-1593693397690-362cb9666fc2?auto=format&fit=crop&w=600&q=80",
      "houseboat": "https://images.unsplash.com/photo-1593693397690-362cb9666fc2?auto=format&fit=crop&w=600&q=80",
      "kettuvallam": "https://images.unsplash.com/photo-1593693397690-362cb9666fc2?auto=format&fit=crop&w=600&q=80",
      "alleppey backwaters": "https://images.unsplash.com/photo-1593693397690-362cb9666fc2?auto=format&fit=crop&w=600&q=80",
      "backwater": "https://images.unsplash.com/photo-1593693397690-362cb9666fc2?auto=format&fit=crop&w=600&q=80",
      "kochi marina": "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?auto=format&fit=crop&w=600&q=80",
      "marine drive kochi": "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?auto=format&fit=crop&w=600&q=80",
      "sunset harbour": "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?auto=format&fit=crop&w=600&q=80",
      "harbour cruise": "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?auto=format&fit=crop&w=600&q=80",
      "deshadan": "https://images.unsplash.com/photo-1593693397690-362cb9666fc2?auto=format&fit=crop&w=600&q=80",
      "hotel fort house": "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=600&q=80",

      // ---- MANALI ---- Hotels, Stays, Treks, Waterfalls & Every Itinerary Location
      "span resort": "https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=600&q=80",
      "beas river resort": "https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=600&q=80",
      "solang valley resort": "https://images.unsplash.com/photo-1549693578-d6b269f53eca?auto=format&fit=crop&w=600&q=80",
      "zostel manali": "https://images.unsplash.com/photo-1596701062351-8c2c14d1fcd1?auto=format&fit=crop&w=600&q=80",
      "old manali village": "https://images.unsplash.com/photo-1596701062351-8c2c14d1fcd1?auto=format&fit=crop&w=600&q=80",
      "old manali": "https://images.unsplash.com/photo-1596701062351-8c2c14d1fcd1?auto=format&fit=crop&w=600&q=80",
      "apple orchard manali": "https://images.unsplash.com/photo-1549693578-d6b269f53eca?auto=format&fit=crop&w=600&q=80",
      "vashisht temple": "https://images.unsplash.com/photo-1549693578-d6b269f53eca?auto=format&fit=crop&w=600&q=80",
      "vashisht base village": "https://images.unsplash.com/photo-1549693578-d6b269f53eca?auto=format&fit=crop&w=600&q=80",
      "vashisht": "https://images.unsplash.com/photo-1549693578-d6b269f53eca?auto=format&fit=crop&w=600&q=80",
      "jogini waterfalls": "https://images.unsplash.com/photo-1432406186267-5c2492669386?auto=format&fit=crop&w=600&q=80",
      "jogini trek": "https://images.unsplash.com/photo-1432406186267-5c2492669386?auto=format&fit=crop&w=600&q=80",
      "jogini": "https://images.unsplash.com/photo-1432406186267-5c2492669386?auto=format&fit=crop&w=600&q=80",
      "solang valley adventure hub": "https://images.unsplash.com/photo-1596701062351-8c2c14d1fcd1?auto=format&fit=crop&w=600&q=80",
      "solang valley": "https://images.unsplash.com/photo-1596701062351-8c2c14d1fcd1?auto=format&fit=crop&w=600&q=80",
      "paragliding manali": "https://images.unsplash.com/photo-1596701062351-8c2c14d1fcd1?auto=format&fit=crop&w=600&q=80",
      "sethan base village": "https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=600&q=80",
      "sethan village": "https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=600&q=80",
      "hampta pass": "https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=600&q=80",
      "hampta trek": "https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=600&q=80",
      "hampta valley viewpoint": "https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=600&q=80",
      "hampta valley": "https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=600&q=80",
      "hampta": "https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=600&q=80",
      "pir panjal range": "https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=600&q=80",
      "gulaba base village": "https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=600&q=80",
      "gulaba": "https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=600&q=80",
      "bhrigu lake trail": "https://images.unsplash.com/photo-1549693578-d6b269f53eca?auto=format&fit=crop&w=600&q=80",
      "bhrigu lake": "https://images.unsplash.com/photo-1549693578-d6b269f53eca?auto=format&fit=crop&w=600&q=80",
      "alpine meadow manali": "https://images.unsplash.com/photo-1549693578-d6b269f53eca?auto=format&fit=crop&w=600&q=80",
      "rahala waterfalls": "https://images.unsplash.com/photo-1432406186267-5c2492669386?auto=format&fit=crop&w=600&q=80",
      "glacier waterfall": "https://images.unsplash.com/photo-1432406186267-5c2492669386?auto=format&fit=crop&w=600&q=80",
      "beas river rafting": "https://images.unsplash.com/photo-1432406186267-5c2492669386?auto=format&fit=crop&w=600&q=80",
      "beas river": "https://images.unsplash.com/photo-1432406186267-5c2492669386?auto=format&fit=crop&w=600&q=80",
      "pirdi rafting": "https://images.unsplash.com/photo-1432406186267-5c2492669386?auto=format&fit=crop&w=600&q=80",
      "cafe 1947": "https://images.unsplash.com/photo-1596701062351-8c2c14d1fcd1?auto=format&fit=crop&w=600&q=80",
      "old manali riverside cafe": "https://images.unsplash.com/photo-1596701062351-8c2c14d1fcd1?auto=format&fit=crop&w=600&q=80",

      // ---- KYOTO ---- Hotels, Spots, Shrines, Districts & Every Itinerary Location
      "sowaka ryokan": "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=600&q=80",
      "tatami room": "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=600&q=80",
      "zen garden kyoto": "https://images.unsplash.com/photo-1549633030-89d349e5ac13?auto=format&fit=crop&w=600&q=80",
      "kyoto granbell": "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=600&q=80",
      "piece hostel sanjo": "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=600&q=80",
      "kinkaku-ji": "https://images.unsplash.com/photo-1549633030-89d349e5ac13?auto=format&fit=crop&w=600&q=80",
      "kinkakuji": "https://images.unsplash.com/photo-1549633030-89d349e5ac13?auto=format&fit=crop&w=600&q=80",
      "golden pavilion": "https://images.unsplash.com/photo-1549633030-89d349e5ac13?auto=format&fit=crop&w=600&q=80",
      "arashiyama bamboo": "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=600&q=80",
      "bamboo grove": "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=600&q=80",
      "arashiyama": "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=600&q=80",
      "tenryu-ji": "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=600&q=80",
      "fushimi inari": "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=600&q=80",
      "fushimi": "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=600&q=80",
      "torii gates": "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=600&q=80",
      "kiyomizu-dera": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80",
      "kiyomizu temple": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80",
      "ninenzaka": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80",
      "gion district": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80",
      "shirakawa canal": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80",
      "hanami-koji": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80",
      "geisha": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80",
      "ryoan-ji": "https://images.unsplash.com/photo-1549633030-89d349e5ac13?auto=format&fit=crop&w=600&q=80",
      "rock garden": "https://images.unsplash.com/photo-1549633030-89d349e5ac13?auto=format&fit=crop&w=600&q=80",
      "nishiki market": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80",
      "kyoto kitchen": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80",
      "matcha ice cream": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80",
      "iwatayama monkey": "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=600&q=80",
      "monkey park kyoto": "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=600&q=80",
      "pontocho alley": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80",
      "pontocho": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80",

      // ---- FLORENCE ---- Hotels, Spots, Markets & Every Itinerary Location
      "villa cora": "https://images.unsplash.com/photo-1519677584237-752f8853252e?auto=format&fit=crop&w=600&q=80",
      "grand hotel mediterraneo": "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=600&q=80",
      "fh55 grand hotel": "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=600&q=80",
      "ostello bello firenze": "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=600&q=80",
      "ostello bello": "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=600&q=80",
      "duomo florence": "https://images.unsplash.com/photo-1504198453319-5ce911bafcde?auto=format&fit=crop&w=600&q=80",
      "cathedral of santa maria": "https://images.unsplash.com/photo-1504198453319-5ce911bafcde?auto=format&fit=crop&w=600&q=80",
      "brunelleschi dome": "https://images.unsplash.com/photo-1504198453319-5ce911bafcde?auto=format&fit=crop&w=600&q=80",
      "giotto bell tower": "https://images.unsplash.com/photo-1504198453319-5ce911bafcde?auto=format&fit=crop&w=600&q=80",
      "duomo": "https://images.unsplash.com/photo-1504198453319-5ce911bafcde?auto=format&fit=crop&w=600&q=80",
      "uffizi gallery": "https://images.unsplash.com/photo-1601961405399-801fb1f34581?auto=format&fit=crop&w=600&q=80",
      "birth of venus": "https://images.unsplash.com/photo-1601961405399-801fb1f34581?auto=format&fit=crop&w=600&q=80",
      "botticelli": "https://images.unsplash.com/photo-1601961405399-801fb1f34581?auto=format&fit=crop&w=600&q=80",
      "uffizi": "https://images.unsplash.com/photo-1601961405399-801fb1f34581?auto=format&fit=crop&w=600&q=80",
      "ponte vecchio": "https://images.unsplash.com/photo-1528114039593-4366cc08227d?auto=format&fit=crop&w=600&q=80",
      "oltrarno": "https://images.unsplash.com/photo-1528114039593-4366cc08227d?auto=format&fit=crop&w=600&q=80",
      "piazzale michelangelo": "https://images.unsplash.com/photo-1528114039593-4366cc08227d?auto=format&fit=crop&w=600&q=80",
      "florence sunset": "https://images.unsplash.com/photo-1528114039593-4366cc08227d?auto=format&fit=crop&w=600&q=80",
      "piazza della signoria": "https://images.unsplash.com/photo-1601961405399-801fb1f34581?auto=format&fit=crop&w=600&q=80",
      "palazzo vecchio": "https://images.unsplash.com/photo-1601961405399-801fb1f34581?auto=format&fit=crop&w=600&q=80",
      "accademia gallery": "https://images.unsplash.com/photo-1601961405399-801fb1f34581?auto=format&fit=crop&w=600&q=80",
      "david sculpture": "https://images.unsplash.com/photo-1601961405399-801fb1f34581?auto=format&fit=crop&w=600&q=80",
      "boboli gardens": "https://images.unsplash.com/photo-1519677584237-752f8853252e?auto=format&fit=crop&w=600&q=80",
      "pitti palace": "https://images.unsplash.com/photo-1519677584237-752f8853252e?auto=format&fit=crop&w=600&q=80",
      "mercato centrale": "https://images.unsplash.com/photo-1528114039593-4366cc08227d?auto=format&fit=crop&w=600&q=80",
      "san lorenzo market": "https://images.unsplash.com/photo-1528114039593-4366cc08227d?auto=format&fit=crop&w=600&q=80",
      "leather market florence": "https://images.unsplash.com/photo-1528114039593-4366cc08227d?auto=format&fit=crop&w=600&q=80",
      "bistecca fiorentina": "https://images.unsplash.com/photo-1519677584237-752f8853252e?auto=format&fit=crop&w=600&q=80",
      "tuscan steak dinner": "https://images.unsplash.com/photo-1519677584237-752f8853252e?auto=format&fit=crop&w=600&q=80",

      // ---- MUMBAI ---- All spots, hotels, itinerary locations
      "gateway of india": "https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?auto=format&fit=crop&w=600&q=80",
      "taj mahal palace hotel": "https://images.unsplash.com/photo-1606046604972-77cc76aee944?auto=format&fit=crop&w=600&q=80",
      "taj mahal palace": "https://images.unsplash.com/photo-1606046604972-77cc76aee944?auto=format&fit=crop&w=600&q=80",
      "elephanta caves": "https://images.unsplash.com/photo-1567361672830-f7ce5bdca5ba?auto=format&fit=crop&w=600&q=80",
      "elephanta island": "https://images.unsplash.com/photo-1567361672830-f7ce5bdca5ba?auto=format&fit=crop&w=600&q=80",
      "marine drive": "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=600&q=80",
      "queen's necklace": "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=600&q=80",
      "dharavi": "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=600&q=80",
      "colaba causeway": "https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?auto=format&fit=crop&w=600&q=80",
      "bandra worli sea link": "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=600&q=80",
      "sea link": "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=600&q=80",
      "siddhivinayak": "https://images.unsplash.com/photo-1571366343168-631c5d684eff?auto=format&fit=crop&w=600&q=80",
      "juhu beach": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=600&q=80",
      "chhatrapati shivaji terminus": "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80",
      "cst station": "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80",
      "abode bombay": "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",

      // ---- DELHI ---- All spots, hotels, itinerary locations
      "red fort": "https://images.unsplash.com/photo-1582653291997-079a1c04e5a1?auto=format&fit=crop&w=600&q=80",
      "lal qila": "https://images.unsplash.com/photo-1582653291997-079a1c04e5a1?auto=format&fit=crop&w=600&q=80",
      "india gate": "https://images.unsplash.com/photo-1597040663342-45b6af3d91a5?auto=format&fit=crop&w=600&q=80",
      "humayun's tomb": "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=600&q=80",
      "humayun tomb": "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=600&q=80",
      "qutub minar": "https://images.unsplash.com/photo-1583041771257-e9e28d76b8f2?auto=format&fit=crop&w=600&q=80",
      "qutb minar": "https://images.unsplash.com/photo-1583041771257-e9e28d76b8f2?auto=format&fit=crop&w=600&q=80",
      "chandni chowk": "https://images.unsplash.com/photo-1583953479406-d5fc661a55c7?auto=format&fit=crop&w=600&q=80",
      "jama masjid": "https://images.unsplash.com/photo-1588416499018-d8c621e2bb58?auto=format&fit=crop&w=600&q=80",
      "lodhi garden": "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=600&q=80",
      "hauz khas village": "https://images.unsplash.com/photo-1618083707368-b3823daa2726?auto=format&fit=crop&w=600&q=80",
      "connaught place": "https://images.unsplash.com/photo-1597040663342-45b6af3d91a5?auto=format&fit=crop&w=600&q=80",
      "akshardham": "https://images.unsplash.com/photo-1571366343168-631c5d684eff?auto=format&fit=crop&w=600&q=80",
      "dilli haat": "https://images.unsplash.com/photo-1561543226663-1fb55c61c2e2?auto=format&fit=crop&w=600&q=80",
      "imperial new delhi": "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80",
      "haveli dharampura": "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=600&q=80",

      // ---- GOA ---- All beaches, churches, markets, waterfalls
      "baga beach": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=600&q=80",
      "calangute beach": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=600&q=80",
      "basilica of bom jesus": "https://images.unsplash.com/photo-1601134467661-3d775b999c18?auto=format&fit=crop&w=600&q=80",
      "bom jesus": "https://images.unsplash.com/photo-1601134467661-3d775b999c18?auto=format&fit=crop&w=600&q=80",
      "se cathedral": "https://images.unsplash.com/photo-1601134467661-3d775b999c18?auto=format&fit=crop&w=600&q=80",
      "dudhsagar waterfalls": "https://images.unsplash.com/photo-1432406186267-5c2492669386?auto=format&fit=crop&w=600&q=80",
      "dudhsagar falls": "https://images.unsplash.com/photo-1432406186267-5c2492669386?auto=format&fit=crop&w=600&q=80",
      "anjuna flea market": "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=600&q=80",
      "anjuna beach": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=600&q=80",
      "palolem beach": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=600&q=80",
      "chapora fort": "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=600&q=80",
      "vagator beach": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=600&q=80",
      "spice plantation": "https://images.unsplash.com/photo-1571316736680-b4b1be73ed93?auto=format&fit=crop&w=600&q=80",
      "tito's lane": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80",
      "taj exotica goa": "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80",

      // ---- RISHIKESH ---- Ghats, bridges, rafting, ashrams
      "laxman jhula": "https://images.unsplash.com/photo-1591521678608-38e3c8b73979?auto=format&fit=crop&w=600&q=80",
      "ram jhula": "https://images.unsplash.com/photo-1591521678608-38e3c8b73979?auto=format&fit=crop&w=600&q=80",
      "triveni ghat": "https://images.unsplash.com/photo-1561361531-997c5e23d508?auto=format&fit=crop&w=600&q=80",
      "beatles ashram": "https://images.unsplash.com/photo-1591521678608-38e3c8b73979?auto=format&fit=crop&w=600&q=80",
      "maharishi ashram": "https://images.unsplash.com/photo-1591521678608-38e3c8b73979?auto=format&fit=crop&w=600&q=80",
      "shivpuri rafting": "https://images.unsplash.com/photo-1432406186267-5c2492669386?auto=format&fit=crop&w=600&q=80",
      "white water rafting": "https://images.unsplash.com/photo-1432406186267-5c2492669386?auto=format&fit=crop&w=600&q=80",
      "parmarth niketan": "https://images.unsplash.com/photo-1561361531-997c5e23d508?auto=format&fit=crop&w=600&q=80",
      "neelkanth mahadev": "https://images.unsplash.com/photo-1591521678608-38e3c8b73979?auto=format&fit=crop&w=600&q=80",
      "rajaji national park": "https://images.unsplash.com/photo-1562619425-c307bb9cd3a9?auto=format&fit=crop&w=600&q=80",
      "byasi camping": "https://images.unsplash.com/photo-1591521678608-38e3c8b73979?auto=format&fit=crop&w=600&q=80",
      "aloha on the ganges": "https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=600&q=80",
      "atali ganga": "https://images.unsplash.com/photo-1591521678608-38e3c8b73979?auto=format&fit=crop&w=600&q=80",

      // ---- AMRITSAR ---- Golden Temple, Wagah, market
      "golden temple": "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=600&q=80",
      "harmandir sahib": "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=600&q=80",
      "wagah border": "https://images.unsplash.com/photo-1555400038-63f5ba517a47?auto=format&fit=crop&w=600&q=80",
      "beating retreat wagah": "https://images.unsplash.com/photo-1555400038-63f5ba517a47?auto=format&fit=crop&w=600&q=80",
      "jallianwala bagh": "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=600&q=80",
      "partition museum": "https://images.unsplash.com/photo-1582582653291997?auto=format&fit=crop&w=600&q=80",
      "durgiana temple": "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=600&q=80",
      "kesar da dhaba": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80",
      "ram bagh garden": "https://images.unsplash.com/photo-1598103328574-d4b3eb03a586?auto=format&fit=crop&w=600&q=80",
      "lawrence road amritsar": "https://images.unsplash.com/photo-1561543226663-1fb55c61c2e2?auto=format&fit=crop&w=600&q=80",
      "langar golden temple": "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=600&q=80",

      // ---- LEH & LADAKH ---- Lakes, passes, monasteries
      "pangong lake": "https://images.unsplash.com/photo-1617526738882-1ea945ce3c0b?auto=format&fit=crop&w=600&q=80",
      "pangong tso": "https://images.unsplash.com/photo-1617526738882-1ea945ce3c0b?auto=format&fit=crop&w=600&q=80",
      "nubra valley": "https://images.unsplash.com/photo-1614082242765-7c99bc013511?auto=format&fit=crop&w=600&q=80",
      "nubra sand dunes": "https://images.unsplash.com/photo-1614082242765-7c99bc013511?auto=format&fit=crop&w=600&q=80",
      "bactrian camel": "https://images.unsplash.com/photo-1614082242765-7c99bc013511?auto=format&fit=crop&w=600&q=80",
      "khardung la": "https://images.unsplash.com/photo-1596701062351-8c2c14d1fcd1?auto=format&fit=crop&w=600&q=80",
      "khardung la pass": "https://images.unsplash.com/photo-1596701062351-8c2c14d1fcd1?auto=format&fit=crop&w=600&q=80",
      "thiksey monastery": "https://images.unsplash.com/photo-1571366343168-631c5d684eff?auto=format&fit=crop&w=600&q=80",
      "hemis monastery": "https://images.unsplash.com/photo-1571366343168-631c5d684eff?auto=format&fit=crop&w=600&q=80",
      "shanti stupa": "https://images.unsplash.com/photo-1617526738882-1ea945ce3c0b?auto=format&fit=crop&w=600&q=80",
      "leh palace": "https://images.unsplash.com/photo-1617526738882-1ea945ce3c0b?auto=format&fit=crop&w=600&q=80",
      "diskit monastery": "https://images.unsplash.com/photo-1571366343168-631c5d684eff?auto=format&fit=crop&w=600&q=80",
      "magnetic hill": "https://images.unsplash.com/photo-1617526738882-1ea945ce3c0b?auto=format&fit=crop&w=600&q=80",
      "grand dragon ladakh": "https://images.unsplash.com/photo-1606046604972-77cc76aee944?auto=format&fit=crop&w=600&q=80",

      // ---- JODHPUR ---- Fort, cenotaphs, desert
      "mehrangarh fort": "https://images.unsplash.com/photo-1611576492249-7b01b3e4b8e7?auto=format&fit=crop&w=600&q=80",
      "mehrangarh": "https://images.unsplash.com/photo-1611576492249-7b01b3e4b8e7?auto=format&fit=crop&w=600&q=80",
      "jaswant thada": "https://images.unsplash.com/photo-1590050752117-238cb0612b1b?auto=format&fit=crop&w=600&q=80",
      "umaid bhawan palace jodhpur": "https://images.unsplash.com/photo-1585135497273-1a86b09fe707?auto=format&fit=crop&w=600&q=80",
      "clock tower jodhpur": "https://images.unsplash.com/photo-1561543226663-1fb55c61c2e2?auto=format&fit=crop&w=600&q=80",
      "sardar market": "https://images.unsplash.com/photo-1561543226663-1fb55c61c2e2?auto=format&fit=crop&w=600&q=80",
      "mandore gardens": "https://images.unsplash.com/photo-1598103328574-d4b3eb03a586?auto=format&fit=crop&w=600&q=80",
      "balsamand lake": "https://images.unsplash.com/photo-1469796466635-455ede028ac4?auto=format&fit=crop&w=600&q=80",
      "osian desert": "https://images.unsplash.com/photo-1614082242765-7c99bc013511?auto=format&fit=crop&w=600&q=80",
      "osian safari": "https://images.unsplash.com/photo-1614082242765-7c99bc013511?auto=format&fit=crop&w=600&q=80",
      "blue city jodhpur": "https://images.unsplash.com/photo-1611576492249-7b01b3e4b8e7?auto=format&fit=crop&w=600&q=80",
      "pal haveli": "https://images.unsplash.com/photo-1598977123418-45f04b01f4ac?auto=format&fit=crop&w=600&q=80",

      // ---- DARJEELING ---- Tea estates, toy train, sunrise
      "tiger hill sunrise": "https://images.unsplash.com/photo-1544984243-ec57ea16fe25?auto=format&fit=crop&w=600&q=80",
      "tiger hill": "https://images.unsplash.com/photo-1544984243-ec57ea16fe25?auto=format&fit=crop&w=600&q=80",
      "kangchenjunga": "https://images.unsplash.com/photo-1544984243-ec57ea16fe25?auto=format&fit=crop&w=600&q=80",
      "darjeeling himalayan railway": "https://images.unsplash.com/photo-1473042904451-00171c69419d?auto=format&fit=crop&w=600&q=80",
      "toy train darjeeling": "https://images.unsplash.com/photo-1473042904451-00171c69419d?auto=format&fit=crop&w=600&q=80",
      "batasia loop": "https://images.unsplash.com/photo-1544984243-ec57ea16fe25?auto=format&fit=crop&w=600&q=80",
      "happy valley tea estate": "https://images.unsplash.com/photo-1571316736680-b4b1be73ed93?auto=format&fit=crop&w=600&q=80",
      "happy valley tea": "https://images.unsplash.com/photo-1571316736680-b4b1be73ed93?auto=format&fit=crop&w=600&q=80",
      "makaibari tea garden": "https://images.unsplash.com/photo-1571316736680-b4b1be73ed93?auto=format&fit=crop&w=600&q=80",
      "makaibari": "https://images.unsplash.com/photo-1571316736680-b4b1be73ed93?auto=format&fit=crop&w=600&q=80",
      "padmaja naidu zoo": "https://images.unsplash.com/photo-1562619425-c307bb9cd3a9?auto=format&fit=crop&w=600&q=80",
      "ghoom monastery": "https://images.unsplash.com/photo-1571366343168-631c5d684eff?auto=format&fit=crop&w=600&q=80",
      "chowrasta mall road": "https://images.unsplash.com/photo-1544984243-ec57ea16fe25?auto=format&fit=crop&w=600&q=80",
      "glenary's": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80",
      "elgin darjeeling": "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80",

      // ---- MYSURU / MYSORE ---- Palace, temples, gardens
      "mysore palace": "https://images.unsplash.com/photo-1598977123418-45f04b01f4ac?auto=format&fit=crop&w=600&q=80",
      "amba vilas": "https://images.unsplash.com/photo-1598977123418-45f04b01f4ac?auto=format&fit=crop&w=600&q=80",
      "chamundi hills": "https://images.unsplash.com/photo-1571366343168-631c5d684eff?auto=format&fit=crop&w=600&q=80",
      "chamundeshwari": "https://images.unsplash.com/photo-1571366343168-631c5d684eff?auto=format&fit=crop&w=600&q=80",
      "brindavan gardens": "https://images.unsplash.com/photo-1598103328574-d4b3eb03a586?auto=format&fit=crop&w=600&q=80",
      "brindavan": "https://images.unsplash.com/photo-1598103328574-d4b3eb03a586?auto=format&fit=crop&w=600&q=80",
      "devaraja market": "https://images.unsplash.com/photo-1561543226663-1fb55c61c2e2?auto=format&fit=crop&w=600&q=80",
      "srirangapatna": "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=600&q=80",
      "tipu sultan fort": "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=600&q=80",
      "karanji lake": "https://images.unsplash.com/photo-1469796466635-455ede028ac4?auto=format&fit=crop&w=600&q=80",
      "st. philomena": "https://images.unsplash.com/photo-1601134467661-3d775b999c18?auto=format&fit=crop&w=600&q=80",
      "lalitha mahal palace": "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=600&q=80",
      "mysore silk": "https://images.unsplash.com/photo-1561543226663-1fb55c61c2e2?auto=format&fit=crop&w=600&q=80",

      // ---- HAMPI ---- Ruins, temples, river, village
      "virupaksha temple": "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=600&q=80",
      "virupaksha": "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=600&q=80",
      "vittala temple": "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=600&q=80",
      "stone chariot hampi": "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=600&q=80",
      "lotus mahal": "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=600&q=80",
      "elephant stables hampi": "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=600&q=80",
      "matanga hill": "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=600&q=80",
      "hemakuta hill": "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=600&q=80",
      "tungabhadra river": "https://images.unsplash.com/photo-1469796466635-455ede028ac4?auto=format&fit=crop&w=600&q=80",
      "coracle ride hampi": "https://images.unsplash.com/photo-1469796466635-455ede028ac4?auto=format&fit=crop&w=600&q=80",
      "hippie island": "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=600&q=80",
      "virupapur gadde": "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=600&q=80",
      "anegundi": "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=600&q=80",
      "hampi bazaar": "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=600&q=80",

      // ---- BALI ---- Rice terraces, temples, volcano
      "tegalalang rice terraces": "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80",
      "tegalalang": "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80",
      "tanah lot": "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80",
      "uluwatu cliff temple": "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80",
      "uluwatu": "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80",
      "kecak fire dance": "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80",
      "mount batur trek": "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=600&q=80",
      "mount batur": "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=600&q=80",
      "tirta gangga": "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80",
      "ubud sacred monkey forest": "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80",
      "ubud rice terraces": "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80",
      "ubud royal palace": "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80",
      "ubud art market": "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=600&q=80",
      "seminyak beach": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=600&q=80",
      "kuta beach bali": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=600&q=80",
      "nusa penida": "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80",
      "four seasons bali": "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80",

      // ---- BANGKOK ---- Temples, markets, rooftops
      "grand palace bangkok": "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=600&q=80",
      "wat phra kaew": "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=600&q=80",
      "wat pho": "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=600&q=80",
      "reclining buddha": "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=600&q=80",
      "wat arun": "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=600&q=80",
      "temple of dawn": "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=600&q=80",
      "damnoen saduak floating market": "https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?auto=format&fit=crop&w=600&q=80",
      "floating market bangkok": "https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?auto=format&fit=crop&w=600&q=80",
      "chatuchak market": "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=600&q=80",
      "khao san road": "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=600&q=80",
      "sirocco sky bar": "https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?auto=format&fit=crop&w=600&q=80",
      "lumphini park": "https://images.unsplash.com/photo-1598103328574-d4b3eb03a586?auto=format&fit=crop&w=600&q=80",
      "jim thompson house": "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=600&q=80",
      "mandarin oriental bangkok": "https://images.unsplash.com/photo-1606046604972-77cc76aee944?auto=format&fit=crop&w=600&q=80",

      // ---- SINGAPORE ---- Marina Bay, Gardens, Sentosa
      "marina bay sands": "https://images.unsplash.com/photo-1565967511849-76a60a516170?auto=format&fit=crop&w=600&q=80",
      "gardens by the bay": "https://images.unsplash.com/photo-1565967511849-76a60a516170?auto=format&fit=crop&w=600&q=80",
      "supertree grove": "https://images.unsplash.com/photo-1565967511849-76a60a516170?auto=format&fit=crop&w=600&q=80",
      "sentosa island": "https://images.unsplash.com/photo-1565967511849-76a60a516170?auto=format&fit=crop&w=600&q=80",
      "palawan beach singapore": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=600&q=80",
      "universal studios singapore": "https://images.unsplash.com/photo-1565967511849-76a60a516170?auto=format&fit=crop&w=600&q=80",
      "chinatown singapore": "https://images.unsplash.com/photo-1565967511849-76a60a516170?auto=format&fit=crop&w=600&q=80",
      "maxwell food centre": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80",
      "tian tian chicken rice": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80",
      "little india singapore": "https://images.unsplash.com/photo-1565967511849-76a60a516170?auto=format&fit=crop&w=600&q=80",
      "clarke quay": "https://images.unsplash.com/photo-1565967511849-76a60a516170?auto=format&fit=crop&w=600&q=80",
      "orchard road": "https://images.unsplash.com/photo-1565967511849-76a60a516170?auto=format&fit=crop&w=600&q=80",

      // ---- SEOUL ---- Palaces, K-pop, culture
      "gyeongbokgung palace": "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=600&q=80",
      "gyeongbokgung": "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=600&q=80",
      "bukchon hanok village": "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=600&q=80",
      "bukchon": "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=600&q=80",
      "namsan tower": "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=600&q=80",
      "n seoul tower": "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=600&q=80",
      "myeongdong": "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=600&q=80",
      "dongdaemun design plaza": "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=600&q=80",
      "ddp": "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=600&q=80",
      "gwangjang market": "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=600&q=80",
      "insadong": "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=600&q=80",
      "hongdae": "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=600&q=80",
      "lotte world": "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=600&q=80",
      "the shilla seoul": "https://images.unsplash.com/photo-1606046604972-77cc76aee944?auto=format&fit=crop&w=600&q=80",

      // ---- DUBAI ---- Skyscrapers, desert, souks
      "burj khalifa": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80",
      "at the top burj": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80",
      "dubai mall": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80",
      "dubai fountain": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80",
      "palm jumeirah": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80",
      "burj al arab": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80",
      "dubai creek": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80",
      "gold souk dubai": "https://images.unsplash.com/photo-1561543226663-1fb55c61c2e2?auto=format&fit=crop&w=600&q=80",
      "spice souk dubai": "https://images.unsplash.com/photo-1561543226663-1fb55c61c2e2?auto=format&fit=crop&w=600&q=80",
      "desert safari dubai": "https://images.unsplash.com/photo-1614082242765-7c99bc013511?auto=format&fit=crop&w=600&q=80",
      "dune bashing": "https://images.unsplash.com/photo-1614082242765-7c99bc013511?auto=format&fit=crop&w=600&q=80",
      "dubai marina": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80",
      "al fahidi": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80",

      // ---- BARCELONA ---- Gaudi, beaches, Gothic Quarter
      "sagrada familia": "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=600&q=80",
      "sagrada": "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=600&q=80",
      "park güell": "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=600&q=80",
      "park guell": "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=600&q=80",
      "la rambla": "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=600&q=80",
      "rambla": "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=600&q=80",
      "gothic quarter barcelona": "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=600&q=80",
      "barri gotic": "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=600&q=80",
      "la pedrera": "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=600&q=80",
      "casa mila": "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=600&q=80",
      "casa batllo": "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=600&q=80",
      "barceloneta beach": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=600&q=80",
      "camp nou": "https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=600&q=80",
      "picasso museum": "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=600&q=80",
      "el born barcelona": "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=600&q=80",
      "la boqueria": "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=600&q=80",
      "hotel arts barcelona": "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80",

      // ---- LONDON ---- Tower, museums, parks
      "tower of london": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=600&q=80",
      "tower bridge london": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=600&q=80",
      "british museum": "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=600&q=80",
      "hyde park london": "https://images.unsplash.com/photo-1598103328574-d4b3eb03a586?auto=format&fit=crop&w=600&q=80",
      "kensington palace": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=600&q=80",
      "camden market": "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=600&q=80",
      "tate modern": "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=600&q=80",
      "thames southbank": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=600&q=80",
      "borough market": "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=600&q=80",
      "covent garden": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=600&q=80",
      "westminster abbey": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=600&q=80",
      "buckingham palace": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=600&q=80",
      "notting hill": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=600&q=80",
      "shoreditch": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=600&q=80",
      "the savoy": "https://images.unsplash.com/photo-1606046604972-77cc76aee944?auto=format&fit=crop&w=600&q=80",

      // ---- AMSTERDAM ---- Canals, museums, tulips
      "anne frank house": "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=600&q=80",
      "rijksmuseum": "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=600&q=80",
      "van gogh museum": "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=600&q=80",
      "jordaan amsterdam": "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=600&q=80",
      "canal ring amsterdam": "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=600&q=80",
      "amsterdam canal cruise": "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=600&q=80",
      "keukenhof gardens": "https://images.unsplash.com/photo-1598103328574-d4b3eb03a586?auto=format&fit=crop&w=600&q=80",
      "keukenhof": "https://images.unsplash.com/photo-1598103328574-d4b3eb03a586?auto=format&fit=crop&w=600&q=80",
      "heineken experience": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80",
      "de pijp": "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=600&q=80",
      "vondelpark": "https://images.unsplash.com/photo-1598103328574-d4b3eb03a586?auto=format&fit=crop&w=600&q=80",
      "waldorf astoria amsterdam": "https://images.unsplash.com/photo-1606046604972-77cc76aee944?auto=format&fit=crop&w=600&q=80",

      // ---- ISTANBUL ---- Hagia Sophia, mosques, bazaars
      "hagia sophia": "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=600&q=80",
      "blue mosque": "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=600&q=80",
      "sultan ahmet camii": "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=600&q=80",
      "topkapi palace": "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=600&q=80",
      "grand bazaar istanbul": "https://images.unsplash.com/photo-1561543226663-1fb55c61c2e2?auto=format&fit=crop&w=600&q=80",
      "kapalicarsi": "https://images.unsplash.com/photo-1561543226663-1fb55c61c2e2?auto=format&fit=crop&w=600&q=80",
      "spice market istanbul": "https://images.unsplash.com/photo-1561543226663-1fb55c61c2e2?auto=format&fit=crop&w=600&q=80",
      "egyptian bazaar": "https://images.unsplash.com/photo-1561543226663-1fb55c61c2e2?auto=format&fit=crop&w=600&q=80",
      "bosphorus cruise": "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=600&q=80",
      "bosphorus ferry": "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=600&q=80",
      "galata tower": "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=600&q=80",
      "balat neighbourhood": "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=600&q=80",
      "istiklal avenue": "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=600&q=80",
      "hippodrome istanbul": "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=600&q=80",
      "four seasons sultanahmet": "https://images.unsplash.com/photo-1606046604972-77cc76aee944?auto=format&fit=crop&w=600&q=80",

      // ---- PRAGUE ---- Charles Bridge, castle, old town
      "charles bridge": "https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=600&q=80",
      "prague castle": "https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=600&q=80",
      "st. vitus cathedral": "https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=600&q=80",
      "astronomical clock prague": "https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=600&q=80",
      "old town square prague": "https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=600&q=80",
      "josefov jewish quarter": "https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=600&q=80",
      "old jewish cemetery": "https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=600&q=80",
      "mala strana": "https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=600&q=80",
      "petrin hill": "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=600&q=80",
      "wenceslas square": "https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=600&q=80",
      "four seasons prague": "https://images.unsplash.com/photo-1606046604972-77cc76aee944?auto=format&fit=crop&w=600&q=80",

      // ---- RIO DE JANEIRO ---- Christ, Sugarloaf, beaches
      "christ the redeemer": "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=600&q=80",
      "cristo redentor": "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=600&q=80",
      "corcovado": "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=600&q=80",
      "sugarloaf mountain": "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=600&q=80",
      "pao de acucar": "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=600&q=80",
      "copacabana beach": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=600&q=80",
      "ipanema beach": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=600&q=80",
      "arpoador rock": "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=600&q=80",
      "lapa arches": "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=600&q=80",
      "santa teresa rio": "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=600&q=80",
      "tijuca forest": "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=600&q=80",
      "maracana stadium": "https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=600&q=80",
      "rio scenarium": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80",
      "copacabana palace": "https://images.unsplash.com/photo-1606046604972-77cc76aee944?auto=format&fit=crop&w=600&q=80",

      // ---- CUSCO & MACHU PICCHU ---- Inca ruins, Sacred Valley
      "machu picchu": "https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=600&q=80",
      "machu pichu": "https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=600&q=80",
      "huayna picchu": "https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=600&q=80",
      "inca trail": "https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=600&q=80",
      "sun gate inti punku": "https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=600&q=80",
      "sacred valley incas": "https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=600&q=80",
      "pisac market": "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=600&q=80",
      "pisac ruins": "https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=600&q=80",
      "ollantaytambo": "https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=600&q=80",
      "moray ruins": "https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=600&q=80",
      "salineras de maras": "https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=600&q=80",
      "sacsayhuaman": "https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=600&q=80",
      "plaza de armas cusco": "https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=600&q=80",
      "aguas calientes": "https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=600&q=80",
      "inkaterra machu picchu": "https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=600&q=80",
      "palacio del inka": "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=600&q=80"
    };



    // Check exact or partial matching for landmarks
    for (const key of Object.keys(landmarkPhotos)) {
      if (lowerQuery.includes(key)) {
        return landmarkPhotos[key];
      }
    }

    // 2. City Mappings
    const cityPhotos = {
      "jaipur": "https://images.unsplash.com/photo-1477587458883-471a5ed94245?auto=format&fit=crop&w=1200&q=80",
      "udaipur": "https://images.unsplash.com/photo-1595658658481-d53d3f999875?auto=format&fit=crop&w=1200&q=80",
      "varanasi": "https://images.unsplash.com/photo-1561361531-997c5e23d508?auto=format&fit=crop&w=1200&q=80",
      "agra": "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80",
      "kochi": "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?auto=format&fit=crop&w=1200&q=80",
      "manali": "https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=1200&q=80",
      "tokyo": "https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?auto=format&fit=crop&w=1200&q=80",
      "kyoto": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80",
      "paris": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80",
      "rome": "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=80",
      "florence": "https://images.unsplash.com/photo-1504198453319-5ce911bafcde?auto=format&fit=crop&w=1200&q=80",
      "new york": "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=1200&q=80",
      // --- NEW INDIA ---
      "mumbai": "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1200&q=80",
      "delhi": "https://images.unsplash.com/photo-1597040663342-45b6af3d91a5?auto=format&fit=crop&w=1200&q=80",
      "goa": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80",
      "rishikesh": "https://images.unsplash.com/photo-1591521678608-38e3c8b73979?auto=format&fit=crop&w=1200&q=80",
      "amritsar": "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1200&q=80",
      "leh": "https://images.unsplash.com/photo-1617526738882-1ea945ce3c0b?auto=format&fit=crop&w=1200&q=80",
      "ladakh": "https://images.unsplash.com/photo-1617526738882-1ea945ce3c0b?auto=format&fit=crop&w=1200&q=80",
      "jodhpur": "https://images.unsplash.com/photo-1611576492249-7b01b3e4b8e7?auto=format&fit=crop&w=1200&q=80",
      "darjeeling": "https://images.unsplash.com/photo-1544984243-ec57ea16fe25?auto=format&fit=crop&w=1200&q=80",
      "mysuru": "https://images.unsplash.com/photo-1593693397690-362cb9666fc2?auto=format&fit=crop&w=1200&q=80",
      "mysore": "https://images.unsplash.com/photo-1593693397690-362cb9666fc2?auto=format&fit=crop&w=1200&q=80",
      "hampi": "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=1200&q=80",
      // --- NEW ASIA & MIDDLE EAST ---
      "bali": "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80",
      "bangkok": "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=1200&q=80",
      "singapore": "https://images.unsplash.com/photo-1565967511849-76a60a516170?auto=format&fit=crop&w=1200&q=80",
      "seoul": "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=1200&q=80",
      "dubai": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80",
      // --- NEW EUROPE ---
      "barcelona": "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=1200&q=80",
      "london": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1200&q=80",
      "amsterdam": "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=1200&q=80",
      "istanbul": "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1200&q=80",
      "prague": "https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=1200&q=80",
      // --- NEW AMERICAS ---
      "rio": "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=1200&q=80",
      "cusco": "https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=1200&q=80",
      "machu picchu": "https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=1200&q=80",
      "peru": "https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=1200&q=80"
    };


    for (const city of Object.keys(cityPhotos)) {
      if (lowerQuery.includes(city)) {
        return cityPhotos[city];
      }
    }

    // 3. Keyword Category Fallbacks
    const categories = [
      { keys: ["hotel", "stay", "resort", "palace", "inn", "hostel", "room", "lodge", "lodging", "villa", "suite"], url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80" },
      { keys: ["temple", "shrine", "church", "mosque", "cathedral", "synagogue", "sacred", "pagoda", "holy", "altar"], url: "https://images.unsplash.com/photo-1542044896530-05d85be9b11a?auto=format&fit=crop&w=600&q=80" },
      { keys: ["bazaar", "market", "shop", "street", "shopping", "mall", "boutique", "vendor", "souvenir"], url: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=600&q=80" },
      { keys: ["museum", "gallery", "art", "exhibit", "history", "exhibition", "monument", "historic", "sculpture", "statue"], url: "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=600&q=80" },
      { keys: ["mountain", "trek", "hike", "nature", "scenic", "view", "peak", "valley", "hills", "waterfall", "park", "garden", "lake", "river", "kund", "beach", "sunset", "ocean", "sea", "forest", "trail"], url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80" },
      { keys: ["cafe", "restaurant", "food", "dinner", "lunch", "breakfast", "dining", "dish", "eatery", "bar", "pub", "bites"], url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80" },
      { keys: ["transit", "metro", "airport", "crossing", "taxi", "cab", "station", "train", "flight", "bus"], url: "https://images.unsplash.com/photo-1473842191133-02f189e3533e?auto=format&fit=crop&w=600&q=80" }
    ];

    for (const cat of categories) {
      if (cat.keys.some(k => {
        // Use word boundary regex to prevent matching sub-words like 'durbar' to 'bar'
        const regex = new RegExp("\\b" + k, "i");
        return regex.test(lowerQuery);
      })) {
        return cat.url;
      }
    }

    // Default scenic background
    return "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80";
  }

  // --- ENSURE COORDINATES FOR LEAFLET ROUTING ---
  function ensureCoordinates(plan) {
    if (!plan) return;

    // 1. Get destination center coordinates
    const destName = plan.destination.toLowerCase();
    let centerLat = 20.5937; // default center of India
    let centerLng = 78.9629;

    const cityCenters = {
      "jaipur": [26.9124, 75.7873],
      "udaipur": [24.5854, 73.7125],
      "varanasi": [25.3176, 82.9739],
      "agra": [27.1767, 78.0081],
      "kochi": [9.9312, 76.2673],
      "manali": [32.2396, 77.1887],
      "tokyo": [35.6762, 139.6503],
      "kyoto": [35.0116, 135.7681],
      "paris": [48.8566, 2.3522],
      "rome": [41.9028, 12.4964],
      "florence": [43.7696, 11.2558],
      "new york": [40.7128, -74.0060],
      // New India
      "mumbai": [19.0760, 72.8777],
      "delhi": [28.6139, 77.2090],
      "goa": [15.2993, 74.1240],
      "rishikesh": [30.0869, 78.2676],
      "amritsar": [31.6340, 74.8723],
      "leh": [34.1526, 77.5771],
      "ladakh": [34.1526, 77.5771],
      "jodhpur": [26.2389, 73.0243],
      "darjeeling": [27.0360, 88.2627],
      "mysuru": [12.2958, 76.6394],
      "mysore": [12.2958, 76.6394],
      "hampi": [15.3350, 76.4600],
      // New Asia & Middle East
      "bali": [-8.3405, 115.0920],
      "bangkok": [13.7563, 100.5018],
      "singapore": [1.3521, 103.8198],
      "seoul": [37.5665, 126.9780],
      "dubai": [25.2048, 55.2708],
      // New Europe
      "barcelona": [41.3851, 2.1734],
      "london": [51.5074, -0.1278],
      "amsterdam": [52.3676, 4.9041],
      "istanbul": [41.0082, 28.9784],
      "prague": [50.0755, 14.4378],
      // Americas
      "rio": [-22.9068, -43.1729],
      "cusco": [-13.5320, -71.9675],
      "machu picchu": [-13.1631, -72.5450],
      "peru": [-13.5320, -71.9675]
    };

    for (const city of Object.keys(cityCenters)) {
      if (destName.includes(city)) {
        [centerLat, centerLng] = cityCenters[city];
        break;
      }
    }

    // 2. Specific landmark coordinate dictionary
    const landmarkCoords = {
      // Jaipur Stays & Spots
      "umaid bhawan": [26.9317, 75.7958],
      "pearl palace": [26.9161, 75.7937],
      "oberoi rajvilas": [26.8797, 75.8893],
      "hawa mahal": [26.9239, 75.8267],
      "amber palace": [26.9855, 75.8513],
      "amer fort": [26.9855, 75.8513],
      "city palace": [26.9258, 75.8237],
      "jantar mantar": [26.9248, 75.8245],
      "bapu bazaar": [26.9165, 75.8202],
      "johari bazaar": [26.9214, 75.8272],
      "panna meena": [26.9877, 75.8582],
      "nahargarh": [26.9374, 75.8156],
      "albert hall": [26.9116, 75.8195],
      "galta ji": [26.9163, 75.8596],
      "chokhi dhani": [26.7663, 75.8456],

      // Tokyo Stays & Spots
      "shibuya crossing": [35.6595, 139.7005],
      "senso-ji": [35.7148, 139.7967],
      "sensoji": [35.7148, 139.7967],
      "meiji shrine": [35.6764, 139.6993],
      "shinjuku gyoen": [35.6838, 139.7104],
      "tokyo tower": [35.6586, 139.7454],
      "harajuku": [35.6715, 139.7030],
      "tsukiji": [35.6655, 139.7705],
      "park hyatt tokyo": [35.6862, 139.6914],
      "hotel gracery shinjuku": [35.6943, 139.7020],
      "apa hotel & resort nishishinjuku": [35.6912, 139.6922],
      "akihabara": [35.6997, 139.7715],
      "teamlab planets": [35.6491, 139.7898],

      // Paris Stays & Spots
      "eiffel tower": [48.8584, 2.2945],
      "louvre": [48.8606, 2.3376],
      "notre-dame": [48.8530, 2.3499],
      "notre dame": [48.8530, 2.3499],
      "arc de triomphe": [48.8738, 2.2950],
      "champs-elysees": [48.8698, 2.3079],
      "seine river cruise": [48.8617, 2.3253],
      "hotel plaza athenee": [48.8659, 2.3013],
      "hotel regina louvre": [48.8631, 2.3312],
      "generator paris": [48.8841, 2.3703],
      "sacred heart": [48.8867, 2.3431],
      "sacre-coeur": [48.8867, 2.3431],
      "versailles": [48.8049, 2.1204],

      // Rome Stays & Spots
      "colosseum": [41.8902, 12.4922],
      "vatican": [41.9029, 12.4534],
      "trevi": [41.9009, 12.4833],
      "pantheon": [41.8986, 12.4769],
      "hotel santa maria": [41.8893, 12.4697],
      "singer palace": [41.8996, 12.4812],
      "the beehive": [41.9042, 12.5028],
      "trastevere": [41.8885, 12.4686],

      // New York Spots & Stays
      "times square": [40.7580, -73.9855],
      "central park": [40.7829, -73.9654],
      "empire state": [40.7484, -73.9857],
      "statue of liberty": [40.6892, -74.0445],
      "plaza hotel": [40.7644, -73.9744],
      "freehand": [40.7408, -73.9839],
      "pod 39": [40.7494, -73.9772],
      "high line": [40.7480, -74.0048],
      
      // Udaipur Stays & Spots
      "taj lake palace": [24.5756, 73.6800],
      "lake pichola hotel": [24.5794, 73.6791],
      "lake pichola": [24.5756, 73.6791],
      "mewar castle": [24.5828, 73.6841],
      "city palace udaipur": [24.5764, 73.6836],
      "alka hotel": [24.5886, 73.6931],
      "jagdish temple": [24.5793, 73.6836],

      // Varanasi Stays & Spots
      "brijrama palace": [25.3075, 83.0116],
      "kashi vishwanath": [25.3109, 83.0104],
      "dashashwamedh": [25.3061, 83.0101],
      "bunkedup": [25.3094, 83.0131],
      "sarnath": [25.3762, 83.0227],

      // Agra Stays & Spots
      "taj mahal": [27.1751, 78.0421],
      "agra fort": [27.1795, 78.0211],
      "oberoi amarvilas": [27.1732, 78.0512],
      "howard plaza": [27.1681, 78.0378],
      "zostel agra": [27.1643, 78.0384],
      "fatehpur": [27.0911, 77.6611],

      // Kochi Stays & Spots
      "brunton boatyard": [9.9691, 76.2425],
      "eighth bastion": [9.9678, 76.2411],
      "zostel fort kochi": [9.9634, 76.2439],
      "chinese fishing": [9.9697, 76.2403],
      "mattancherry": [9.9592, 76.2589],
      "jew town": [9.9565, 76.2599],

      // Manali Stays & Spots
      "span resort": [32.1751, 77.1895],
      "solang valley resort": [32.3164, 77.1581],
      "zostel manali": [32.2594, 77.1852],
      "solang valley adventure": [32.3164, 77.1581],
      "jogini": [32.2642, 77.1952],
      "hampta": [32.2289, 77.2433],

      // Kyoto Stays & Spots
      "sowaka ryokan": [35.0011, 135.7794],
      "kyoto granbell": [35.0034, 135.7725],
      "piece hostel sanjo": [35.0084, 135.7645],
      "kinkaku-ji": [35.0394, 135.7292],
      "arashiyama": [35.0156, 135.6715],
      "fushimi": [34.9671, 135.7727],

      // Florence Stays & Spots
      "villa cora": [43.7584, 11.2486],
      "grand hotel mediterraneo": [43.7663, 11.2721],
      "ostello bello firenze": [43.7785, 11.2494],
      "duomo": [43.7731, 11.2560],
      "uffizi": [43.7678, 11.2553],
      "ponte vecchio": [43.7680, 11.2532]
    };

    function resolveCoords(name) {
      const lower = name.toLowerCase().trim();
      for (const k of Object.keys(landmarkCoords)) {
        if (lower.includes(k)) {
          return landmarkCoords[k];
        }
      }
      // Offset slightly from center if not found to separate markers
      return [
        centerLat + (Math.random() - 0.5) * 0.03,
        centerLng + (Math.random() - 0.5) * 0.03
      ];
    }

    // Assign to Hotels
    plan.hotels.forEach(h => {
      if (typeof h.latitude !== 'number' || typeof h.longitude !== 'number') {
        const [lat, lng] = resolveCoords(h.name);
        h.latitude = lat;
        h.longitude = lng;
      }
    });

    // Assign to Spots
    plan.spots.forEach(s => {
      if (typeof s.latitude !== 'number' || typeof s.longitude !== 'number') {
        const [lat, lng] = resolveCoords(s.name);
        s.latitude = lat;
        s.longitude = lng;
      }
    });

    // Assign to Itinerary
    if (plan.itinerary) {
      plan.itinerary.forEach(day => {
        day.schedule.forEach(sched => {
          if (typeof sched.latitude !== 'number' || typeof sched.longitude !== 'number') {
            const [lat, lng] = resolveCoords(sched.spot);
            sched.latitude = lat;
            sched.longitude = lng;
          }
        });
      });
    }
  }

  // --- CUSTOM DYNAMIC GLASS TOAST NOTIFICATION ---
  function showToast(title, message, type = "success") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast-notification ${type}`;

    let iconClass = "fa-circle-check";
    if (type === "warning") iconClass = "fa-triangle-exclamation";
    if (type === "error") iconClass = "fa-circle-exclamation";

    toast.innerHTML = `
      <div class="toast-icon"><i class="fa-solid ${iconClass}"></i></div>
      <div class="toast-content">
        <h4>${title}</h4>
        <p>${message}</p>
      </div>
    `;

    container.appendChild(toast);

    // Auto dismiss after 6 seconds
    setTimeout(() => {
      toast.classList.add("hide");
      setTimeout(() => {
        toast.remove();
        if (container.children.length === 0) {
          container.remove();
        }
      }, 300);
    }, 6000);
  }

});
