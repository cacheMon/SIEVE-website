document.addEventListener('DOMContentLoaded', function() {
    const sentence = "An Eviction Algorithm Simpler than LRU for Web Caches";
    const words = sentence.split("");
    let i = 0;
    const container = document.getElementById('animated-text');

    function showWord() {
        if (i < words.length) {
            container.textContent += words[i];
            i++;
            setTimeout(showWord, 40); // Timing between words
        } else {
            // Reset and restart the animation after a delay
            setTimeout(() => {
                container.textContent = '';
                i = 0;
                showWord();
            }, 2000); // Delay before restarting
        }
    }
    showWord();
});
