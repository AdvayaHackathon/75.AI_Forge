import { MDCTextField } from "https://cdn.skypack.dev/@material/textfield";
import { TextClassifier, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-text@0.10.0";

// Initialize Material Design Components
const textField = new MDCTextField(document.querySelector(".mdc-text-field"));

// Get the required elements
const input = document.getElementById("input");
const analysisOutput = document.getElementById("analysis-output");
const submit = document.getElementById("submit");
const journalHistoryDiv = document.getElementById("journal-history");
const entrySection = document.getElementById("entry-section");

let textClassifier;
const JOURNAL_STORAGE_KEY = 'aiMentalHealthJournalEntries';
const SAFE_PERSON_KEY = 'aiMentalHealthSafePerson';

// Configuration for negative emotion detection
const NEGATIVE_EMOTIONS = ['sadness', 'anger', 'fear', 'anxiety', 'negative'];
const CONSECUTIVE_NEGATIVE_THRESHOLD = 3; // Alert after this many consecutive negative entries
const TIMESPAN_NEGATIVE_THRESHOLD = 5; // Check if majority of entries in last N entries are negative
const NEGATIVE_MAJORITY_THRESHOLD = 0.6; // 60% or more are negative to trigger alert

// --- Text Classifier Initialization ---
const createTextClassifier = async () => {
    analysisOutput.innerText = "Loading analysis model...";
    try {
        const text = await FilesetResolver.forTextTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-text@0.10.0/wasm");
        textClassifier = await TextClassifier.createFromOptions(text, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/text_classifier/bert_classifier/float32/1/bert_classifier.tflite`
            },
            maxResults: 5 // Keep top 5 results if model provides more
        });
        analysisOutput.innerText = "Model loaded. Ready to analyze entries.";
        console.log("Text classifier loaded.");
        // Load history once the classifier is ready
        loadAndDisplayHistory();
    } catch (error) {
        console.error("Failed to load text classifier:", error);
        analysisOutput.innerText = "Error loading analysis model. Analysis disabled.";
        // Still load history even if classifier fails
        loadAndDisplayHistory();
    }
};

// --- Local Storage Functions ---
function getJournalEntries() {
    const entriesJson = localStorage.getItem(JOURNAL_STORAGE_KEY);
    return entriesJson ? JSON.parse(entriesJson) : [];
}

function saveJournalEntry(entry) {
    const entries = getJournalEntries();
    entries.push(entry);
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries));
}

function getSafePerson() {
    const safePersonJson = localStorage.getItem(SAFE_PERSON_KEY);
    return safePersonJson ? JSON.parse(safePersonJson) : null;
}

function saveSafePerson(name, email) {
    const safePerson = { name, email };
    localStorage.setItem(SAFE_PERSON_KEY, JSON.stringify(safePerson));
}

// --- Display Functions ---
function displayHistory(entries) {
    journalHistoryDiv.innerHTML = ''; // Clear previous history

    if (entries.length === 0) {
        journalHistoryDiv.innerHTML = '<p>No journal entries yet. Write your first one!</p>';
        return;
    }

    // Sort entries by date, newest first
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    entries.forEach(entry => {
        const entryDiv = document.createElement('div');
        entryDiv.classList.add('journal-entry');

        const date = new Date(entry.date).toLocaleString();

        let analysisHtml = 'Analysis: Not available';
        let emotionClass = '';
        
        if (entry.analysis) {
            const topCategory = entry.analysis.classifications?.[0]?.categories?.[0];
            if (topCategory) {
                const categoryName = topCategory.categoryName.toLowerCase();
                analysisHtml = `Sentiment: ${topCategory.categoryName} (Score: ${topCategory.score.toFixed(2)})`;
                
                // Add emotion class for styling
                if (NEGATIVE_EMOTIONS.some(emotion => categoryName.includes(emotion))) {
                    emotionClass = 'negative-emotion';
                } else if (categoryName.includes('positive') || categoryName.includes('joy') || 
                           categoryName.includes('happy') || categoryName.includes('excitement')) {
                    emotionClass = 'positive-emotion';
                } else {
                    emotionClass = 'neutral-emotion';
                }
            } else {
                analysisHtml = `Sentiment: Could not determine`;
            }
        }

        entryDiv.innerHTML = `
            <p><strong>Date:</strong> ${date}</p>
            <p><strong>Entry:</strong> ${entry.text.replace(/\n/g, '<br>')}</p>
            <p class="${emotionClass}"><strong>${analysisHtml}</strong></p>
            <hr>
        `;
        journalHistoryDiv.appendChild(entryDiv);
    });
}

function loadAndDisplayHistory() {
    const entries = getJournalEntries();
    displayHistory(entries);
    
    // Check for negative emotion patterns after loading history
    checkNegativePatterns(entries);
}

// --- Safe Person Setup Functions ---
function setupSafePersonUI() {
    const safePerson = getSafePerson();
    
    // Create SafePerson section if it doesn't exist
    let safePersonSection = document.getElementById('safe-person-section');
    if (!safePersonSection) {
        safePersonSection = document.createElement('section');
        safePersonSection.id = 'safe-person-section';
        safePersonSection.innerHTML = `
            <h2>Safety Contact</h2>
            <p>Set up a trusted contact who can be notified if your mood tracking shows concerning patterns.</p>
            <div class="safe-person-form">
                <label class="mdc-text-field mdc-text-field--filled">
                    <span class="mdc-text-field__ripple"></span>
                    <input id="safe-person-name" class="mdc-text-field__input" type="text" 
                           placeholder="Contact Name" value="${safePerson?.name || ''}">
                    <span class="mdc-line-ripple"></span>
                </label><br>
                <label class="mdc-text-field mdc-text-field--filled">
                    <span class="mdc-text-field__ripple"></span>
                    <input id="safe-person-email" class="mdc-text-field__input" type="email" 
                           placeholder="Contact Email" value="${safePerson?.email || ''}">
                    <span class="mdc-line-ripple"></span>
                </label><br>
                <button id="save-safe-person" class="mdc-button mdc-button--raised">
                    <span class="mdc-button__label">SAVE CONTACT</span>
                </button>
                <p id="safe-person-status" class="status-text"></p>
            </div>
        `;
        
        // Insert after entry section
        const historySectionElement = document.getElementById('history-section');
        historySectionElement.parentNode.insertBefore(safePersonSection, historySectionElement);
        
        // Initialize new Material Design Components
        new MDCTextField(document.querySelector("#safe-person-section .mdc-text-field:nth-child(1)"));
        new MDCTextField(document.querySelector("#safe-person-section .mdc-text-field:nth-child(3)"));
        
        // Add event listener for save button
        document.getElementById('save-safe-person').addEventListener('click', () => {
            const name = document.getElementById('safe-person-name').value.trim();
            const email = document.getElementById('safe-person-email').value.trim();
            
            if (!name || !email) {
                document.getElementById('safe-person-status').innerText = "Please enter both name and email.";
                return;
            }
            
            saveSafePerson(name, email);
            document.getElementById('safe-person-status').innerText = "Contact saved successfully!";
            setTimeout(() => {
                document.getElementById('safe-person-status').innerText = "";
            }, 3000);
        });
    }
}

// --- Negative Emotion Pattern Detection ---
function isNegativeEmotion(entry) {
    if (!entry.analysis || !entry.analysis.classifications?.[0]?.categories?.[0]) {
        return false;
    }
    
    const category = entry.analysis.classifications[0].categories[0].categoryName.toLowerCase();
    return NEGATIVE_EMOTIONS.some(emotion => category.includes(emotion));
}

function checkNegativePatterns(entries) {
    if (entries.length < 2) return; // Need at least 2 entries to detect patterns
    
    // Sort by date (oldest first for sequential analysis)
    const sortedEntries = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Check for consecutive negative entries
    let consecutiveNegativeCount = 0;
    let maxConsecutiveNegative = 0;
    
    for (const entry of sortedEntries) {
        if (isNegativeEmotion(entry)) {
            consecutiveNegativeCount++;
            maxConsecutiveNegative = Math.max(maxConsecutiveNegative, consecutiveNegativeCount);
        } else {
            consecutiveNegativeCount = 0;
        }
    }
    
    // Check percentage of negative emotions in recent entries
    const recentEntries = sortedEntries.slice(-TIMESPAN_NEGATIVE_THRESHOLD);
    const negativeCount = recentEntries.filter(isNegativeEmotion).length;
    const negativePercentage = recentEntries.length > 0 ? negativeCount / recentEntries.length : 0;
    
    // Determine if we should alert
    const shouldAlert = 
        maxConsecutiveNegative >= CONSECUTIVE_NEGATIVE_THRESHOLD || 
        (recentEntries.length >= 3 && negativePercentage >= NEGATIVE_MAJORITY_THRESHOLD);
    
    if (shouldAlert) {
        showNegativePatternAlert(maxConsecutiveNegative, negativePercentage);
    }
}

function showNegativePatternAlert(consecutiveCount, percentage) {
    // Create alert if it doesn't exist
    let alertElement = document.getElementById('negative-pattern-alert');
    if (!alertElement) {
        alertElement = document.createElement('div');
        alertElement.id = 'negative-pattern-alert';
        alertElement.classList.add('alert-box');
        
        document.body.insertBefore(alertElement, document.body.firstChild);
    }
    
    const safePerson = getSafePerson();
    const hasSafePerson = safePerson && safePerson.email;
    
    // Different message based on whether they have a SafePerson set up
    let contactMessage = '';
    if (hasSafePerson) {
        contactMessage = `
            <p>Would you like to reach out to your safety contact (${safePerson.name})?</p>
            <button id="contact-safe-person" class="mdc-button mdc-button--raised">
                <span class="mdc-button__label">CONTACT NOW</span>
            </button>
        `;
    } else {
        contactMessage = `
            <p>Consider setting up a safety contact in the settings below who can be notified when you're feeling low.</p>
        `;
    }
    
    alertElement.innerHTML = `
        <h3>Mood Pattern Alert</h3>
        <p>Your recent journal entries show a pattern of negative emotions that might be worth checking in about.</p>
        ${contactMessage}
        <button id="dismiss-alert" class="mdc-button">
            <span class="mdc-button__label">DISMISS</span>
        </button>
    `;
    
    // Add event listeners for buttons
    document.getElementById('dismiss-alert').addEventListener('click', () => {
        alertElement.remove();
    });
    
    if (hasSafePerson) {
        document.getElementById('contact-safe-person').addEventListener('click', () => {
            contactSafePerson(safePerson);
            alertElement.remove();
        });
    }
}

function contactSafePerson(safePerson) {
    // Prepare email content
    const subject = "Mental Health Check-In Request";
    const body = "Hello, I've been tracking my mood in my journal app, and it has detected a pattern that suggests I might need some support. Could we connect soon? This message was sent through my mental health journal app.";
    
    // Open email client with mailto link
    const mailtoLink = `mailto:${safePerson.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);
    
    // Show confirmation
    alert(`Opening your email client to contact ${safePerson.name}. Thank you for reaching out.`);
}

// --- Event Listener for Submit ---
submit.addEventListener("click", async () => {
    const entryText = input.value.trim();
    if (entryText === "") {
        alert("Please write something in your journal entry.");
        return;
    }

    if (!textClassifier) {
        alert("Analysis model is not ready yet. Please wait or try reloading.");
         // Save entry without analysis if model failed to load
         const newEntry = {
            date: new Date().toISOString(),
            text: entryText,
            analysis: null // Indicate analysis wasn't performed
         };
         saveJournalEntry(newEntry);
         loadAndDisplayHistory(); // Update history display
         input.value = ''; // Clear input field
        return;
    }

    analysisOutput.innerText = "Analyzing...";
    await sleep(50); // Small delay for UI update

    try {
        const result = textClassifier.classify(entryText);
        console.log("Classification Result:", result);

        const newEntry = {
            date: new Date().toISOString(),
            text: entryText,
            analysis: result // Store the full analysis result
        };

        saveJournalEntry(newEntry);
        
        // Display immediate feedback
        const topCategory = result.classifications?.[0]?.categories?.[0];
        if (topCategory) {
            analysisOutput.innerText = `Entry saved. Detected Sentiment: ${topCategory.categoryName} (${topCategory.score.toFixed(2)})`;
        } else {
            analysisOutput.innerText = "Entry saved. Sentiment analysis unclear.";
        }

        input.value = ''; // Clear input field
        
        // Reload history and check patterns with the new entry included
        loadAndDisplayHistory();

    } catch (error) {
        console.error("Error during classification:", error);
        analysisOutput.innerText = "Error analyzing entry. Entry saved without analysis.";
         // Save entry without analysis if classification fails
         const newEntry = {
            date: new Date().toISOString(),
            text: entryText,
            analysis: null // Indicate analysis wasn't performed
         };
         saveJournalEntry(newEntry);
         loadAndDisplayHistory(); // Update history display
         input.value = ''; // Clear input field
    }
});

// --- Utility Functions ---
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Initial Load ---
createTextClassifier(); // Start loading the model immediately
setupSafePersonUI(); // Set up SafePerson UI section