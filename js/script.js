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

// document.addEventListener('DOMContentLoaded', function() {
//     fetch('https://api.github.com/repos/scalalang2/golang-fifo')
//         .then(response => response.json())
//         .then(data => {
//             document.getElementById('golang-fifo').src = data.owner.avatar_url;
//         })
//         .catch(error => console.error('Error fetching author avatar:', error));
    
//     fetch('https://api.github.com/repos/kurtextrem/js-sieve')
//         .then(response => response.json())
//         .then(data => {
//             document.getElementById('js-sieve').src = data.owner.avatar_url;
//         })
//         .catch(error => console.error('Error fetching author avatar for js-sieve:', error));

//     fetch('https://api.github.com/repos/linux-china/sieve-cache')
//         .then(response => response.json())
//         .then(data => {
//             document.getElementById('java-sieve-cache').src = data.owner.avatar_url;
//         })
//         .catch(error => console.error('Error fetching author avatar for java-sieve-cache:', error));
    
//     fetch('https://api.github.com/repos/opencoff/go-sieve')
//         .then(response => response.json())
//         .then(data => {
//             document.getElementById('go-sieve').src = data.owner.avatar_url;
//         })
//         .catch(error => console.error('Error fetching author avatar for go-sieve:', error));
// });

function scrollToLearnMoreSection() {
    const usageSection = document.getElementById('howwork');
    usageSection.scrollIntoView({ behavior: 'smooth' });
  }
