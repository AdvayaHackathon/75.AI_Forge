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
const clearHistoryBtn = document.getElementById("clear-history");

let textClassifier;
const JOURNAL_STORAGE_KEY = 'aiMentalHealthJournalEntries';
const SAFE_PERSON_KEY = 'aiMentalHealthSafePerson';

// Configuration for negative emotion detection
const NEGATIVE_EMOTIONS = ['sadness', 'anger', 'fear', 'anxiety', 'negative'];
const CONSECUTIVE_NEGATIVE_THRESHOLD = 3;
const TIMESPAN_NEGATIVE_THRESHOLD = 5;
const NEGATIVE_MAJORITY_THRESHOLD = 0.6;

// ========== SAFE PERSON FUNCTIONS ========== //
function getSafePerson() {
    const safePersonJson = localStorage.getItem(SAFE_PERSON_KEY);
    return safePersonJson ? JSON.parse(safePersonJson) : null;
}

function saveSafePerson(name, email) {
    const safePerson = { name, email };
    localStorage.setItem(SAFE_PERSON_KEY, JSON.stringify(safePerson));
}

function setupSafePersonUI() {
    const safePerson = getSafePerson();
    
    let safePersonSection = document.getElementById('safe-person-section');
    if (!safePersonSection) {
        safePersonSection = document.createElement('section');
        safePersonSection.id = 'safe-person-section';
        safePersonSection.innerHTML = `
            <h2>Safety Contact</h2>
            <p>Set up a trusted contact who can be notified if your mood tracking shows concerning patterns.</p>
            <div class="safe-person-form">
                <div class="mdc-text-field mdc-text-field--filled" id="name-field">
                    <input id="safe-person-name" class="mdc-text-field__input" type="text" 
                           placeholder="Contact Name" value="${safePerson?.name || ''}">
                    <div class="mdc-line-ripple"></div>
                </div>
                <div class="mdc-text-field mdc-text-field--filled" id="email-field">
                    <input id="safe-person-email" class="mdc-text-field__input" type="email" 
                           placeholder="Contact Email" value="${safePerson?.email || ''}">
                    <div class="mdc-line-ripple"></div>
                </div>
                <button id="save-safe-person" class="mdc-button mdc-button--raised">
                    <span class="mdc-button__label">SAVE CONTACT</span>
                </button>
                <p id="safe-person-status" class="status-text"></p>
            </div>
        `;
        
        entrySection.insertAdjacentElement('afterend', safePersonSection);
        
        new MDCTextField(document.getElementById('name-field'));
        new MDCTextField(document.getElementById('email-field'));
        
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

// ========== JOURNAL ENTRY FUNCTIONS ========== //
function getJournalEntries() {
    const entriesJson = localStorage.getItem(JOURNAL_STORAGE_KEY);
    return entriesJson ? JSON.parse(entriesJson) : [];
}

function saveJournalEntry(entry) {
    const entries = getJournalEntries();
    entries.push(entry);
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries));
}

function clearJournalHistory() {
    localStorage.removeItem(JOURNAL_STORAGE_KEY);
    loadAndDisplayHistory();
}

function displayHistory(entries) {
    journalHistoryDiv.innerHTML = '';

    if (entries.length === 0) {
        journalHistoryDiv.innerHTML = '<p>No journal entries yet. Write your first one!</p>';
        return;
    }

    entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    entries.forEach(entry => {
        const entryDiv = document.createElement('div');
        entryDiv.classList.add('journal-entry');

        const date = new Date(entry.date).toLocaleString();

        let analysisHtml = 'Analysis: Not available 🧐';
        let emotionClass = '';
        let emoji = '';
        
        if (entry.analysis) {
            const topCategory = entry.analysis.classifications?.[0]?.categories?.[0];
            if (topCategory) {
                const categoryName = topCategory.categoryName.toLowerCase();
                const score = topCategory.score.toFixed(2);
                
                if (NEGATIVE_EMOTIONS.some(emotion => categoryName.includes(emotion))) {
                    emotionClass = 'negative-emotion';
                    emoji = '😞';
                } else if (categoryName.includes('positive')) {
                    emotionClass = 'positive-emotion';
                    emoji = '😊';
                } else {
                    emotionClass = 'neutral-emotion';
                    emoji = '😐';
                }
                
                analysisHtml = `Sentiment: ${topCategory.categoryName} ${emoji} (${score})`;
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
    checkNegativePatterns(entries);
}

// ========== ANALYSIS FUNCTIONS ========== //
function isNegativeEmotion(entry) {
    if (!entry.analysis || !entry.analysis.classifications?.[0]?.categories?.[0]) {
        return false;
    }
    
    const category = entry.analysis.classifications[0].categories[0].categoryName.toLowerCase();
    return NEGATIVE_EMOTIONS.some(emotion => category.includes(emotion));
}

function checkNegativePatterns(entries) {
    if (entries.length < 2) return;
    
    const sortedEntries = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
    
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
    
    const recentEntries = sortedEntries.slice(-TIMESPAN_NEGATIVE_THRESHOLD);
    const negativeCount = recentEntries.filter(isNegativeEmotion).length;
    const negativePercentage = recentEntries.length > 0 ? negativeCount / recentEntries.length : 0;
    
    const shouldAlert = 
        maxConsecutiveNegative >= CONSECUTIVE_NEGATIVE_THRESHOLD || 
        (recentEntries.length >= 3 && negativePercentage >= NEGATIVE_MAJORITY_THRESHOLD);
    
    if (shouldAlert) {
        showNegativePatternAlert(maxConsecutiveNegative, negativePercentage);
    }
}

function showNegativePatternAlert(consecutiveCount, percentage) {
    let alertElement = document.getElementById('negative-pattern-alert');
    if (!alertElement) {
        alertElement = document.createElement('div');
        alertElement.id = 'negative-pattern-alert';
        alertElement.classList.add('alert-box');
        document.body.insertBefore(alertElement, document.body.firstChild);
    }
    
    const safePerson = getSafePerson();
    const hasSafePerson = safePerson && safePerson.email;
    
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
            <p>Consider setting up a safety contact who can be notified when you're feeling low.</p>
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
    const subject = "Mental Health Check-In Request";
    const body = "Hello, I've been tracking my mood in my journal app, and it has detected a pattern that suggests I might need some support. Could we connect soon? This message was sent through my mental health journal app.";
    const mailtoLink = `mailto:${safePerson.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);
    alert(`Opening your email client to contact ${safePerson.name}. Thank you for reaching out.`);
}

// ========== TEXT CLASSIFIER ========== //
const createTextClassifier = async () => {
    analysisOutput.innerText = "Loading analysis model...";
    try {
        const text = await FilesetResolver.forTextTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-text@0.10.0/wasm");
        textClassifier = await TextClassifier.createFromOptions(text, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/text_classifier/bert_classifier/float32/1/bert_classifier.tflite`
            },
            maxResults: 5
        });
        analysisOutput.innerText = "Model loaded. Ready to analyze entries.";
        console.log("Text classifier loaded.");
        loadAndDisplayHistory();
    } catch (error) {
        console.error("Failed to load text classifier:", error);
        analysisOutput.innerText = "Error loading analysis model. Analysis disabled.";
        loadAndDisplayHistory();
    }
};

// ========== EVENT LISTENERS ========== //
submit.addEventListener("click", async () => {
    const entryText = input.value.trim();
    if (entryText === "") {
        alert("Please write something in your journal entry.");
        return;
    }

    const newEntry = {
        date: new Date().toISOString(),
        text: entryText,
        analysis: null
    };

    if (textClassifier) {
        analysisOutput.innerText = "Analyzing...";
        try {
            const result = await textClassifier.classify(entryText);
            newEntry.analysis = result;
            
            const topCategory = result.classifications?.[0]?.categories?.[0];
            analysisOutput.innerText = topCategory 
                ? `Entry saved. Detected Sentiment: ${topCategory.categoryName} ${getEmoji(topCategory.categoryName.toLowerCase())} (${topCategory.score.toFixed(2)})`
                : "Entry saved. Sentiment analysis unclear.";
        } catch (error) {
            console.error("Error during classification:", error);
            analysisOutput.innerText = "Error analyzing entry. Entry saved without analysis.";
        }
    } else {
        analysisOutput.innerText = "Model not loaded. Entry saved without analysis.";
    }

    saveJournalEntry(newEntry);
    input.value = '';
    loadAndDisplayHistory();
});

clearHistoryBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to delete ALL journal entries? This cannot be undone!")) {
        clearJournalHistory();
    }
});

// ========== HELPER FUNCTIONS ========== //
function getEmoji(categoryName) {
    if (NEGATIVE_EMOTIONS.some(emotion => categoryName.includes(emotion))) return '😞';
    if (categoryName.includes('positive')) return '😊';
    return '😐';
}

// ========== INITIALIZATION ========== //
createTextClassifier();
setupSafePersonUI();