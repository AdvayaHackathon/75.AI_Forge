
import { MDCTextField } from "https://cdn.skypack.dev/@material/textfield";
import { TextClassifier, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-text@0.10.0";

// Initialize Material Design Components
const textField = new MDCTextField(document.querySelector(".mdc-text-field"));

// Get the required elements
const input = document.getElementById("input");
const analysisOutput = document.getElementById("analysis-output");
const submit = document.getElementById("submit");
const journalHistoryDiv = document.getElementById("journal-history");
const entrySection = document.getElementById("entry-section"); // Use this if needed later

let textClassifier;
const JOURNAL_STORAGE_KEY = 'aiMentalHealthJournalEntries';

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
        // Load history once the classifier is ready (optional, could load sooner)
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
    // Keep the most recent entries, e.g., last 100 (optional)
    // if (entries.length > 100) {
    //     entries.shift(); // Remove the oldest entry
    // }
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries));
}

// --- Display Functions ---
function displayHistory(entries) {
    journalHistoryDiv.innerHTML = ''; // Clear previous history

    if (entries.length === 0) {
        journalHistoryDiv.innerHTML = '<p>No journal entries yet. Write your first one!</p>';
        return;
    }

    // Sort entries by date, newest first (optional)
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    entries.forEach(entry => {
        const entryDiv = document.createElement('div');
        entryDiv.classList.add('journal-entry'); // Add class for styling

        const date = new Date(entry.date).toLocaleString(); // Format date nicely

        let analysisHtml = 'Analysis: Not available';
        if (entry.analysis) {
             // Display the most confident category
            const topCategory = entry.analysis.classifications?.[0]?.categories?.[0];
            if (topCategory) {
                 analysisHtml = `Sentiment: ${topCategory.categoryName} (Score: ${topCategory.score.toFixed(2)})`;
            } else {
                 analysisHtml = `Sentiment: Could not determine`;
            }
        }

        entryDiv.innerHTML = `
            <p><strong>Date:</strong> ${date}</p>
            <p><strong>Entry:</strong> ${entry.text.replace(/\n/g, '<br>')}</p> <p><strong>${analysisHtml}</strong></p>
            <hr>
        `;
        journalHistoryDiv.appendChild(entryDiv);
    });
}

function loadAndDisplayHistory() {
    const entries = getJournalEntries();
    displayHistory(entries);
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
        loadAndDisplayHistory(); // Update history display

        // Display immediate feedback (optional)
        const topCategory = result.classifications?.[0]?.categories?.[0];
        if (topCategory) {
            analysisOutput.innerText = `Entry saved. Detected Sentiment: ${topCategory.categoryName} (${topCategory.score.toFixed(2)})`;
        } else {
            analysisOutput.innerText = "Entry saved. Sentiment analysis unclear.";
        }

        input.value = ''; // Clear input field

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