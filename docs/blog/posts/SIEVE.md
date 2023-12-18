---
date: 2023-12-17
authors:
  - yazhuo
categories:
  - Algorithm
  - Performance
---

# SIEVE is simpler than LRU
Caching is a method of storing temporary data for quick access to keep the online world running smoothly. But with limited space, comes a critical decision: what to keep and what to discard.  This is where **eviction algorithms** come into play. Our team recently designed a new cache eviction algorithm called **SIEVE**: it is both very effective and simple with just one FIFO queue.
<!-- more -->

## The Importance of Simplicity
In the world of cache eviction algorithms, there's something to be said for keeping it simple. Complex algorithms, for all their sophistication, can bring their own set of headaches. They can be tricky to debug, sometimes unexpectedly drag down efficiency, and even put a damper on throughput and scalability because of their higher computational needs. 

On the flip side, simpler eviction methods, though maybe not as flashy in managing cache, have a knack for improving system throughput and scalability. Just look at examples like MemC3 and Segcache. They rely on straightforward approaches like FIFO and manage to significantly boost system performance. It turns out, sometimes, the best move is to keep things uncomplicated!

## Meet SIEVE: The Harmony of Simplicity and Efficiency
SIEVE is an algorithm that decides what to keep in the cache and what to discard. But unlike its predecessors, it does this with a flair for simplicity and efficiency.

### A Technical Walkthrough of SIEVE
SIEVE operates on a beautifully simple yet highly effective principle. It's built on a FIFO queue, supplemented by a "hand" pointer that navigates through the cache. Each object in the queue has a bit indicating whether it's been visited. On a cache hit, SIEVE marks the object as visited. In the event of a cache miss, SIEVE checks the object pointed to by the hand. If the object has been visited, its visited bit is reset, and the hand moves to the next position, keeping the retained object in its original position in the queue. 
This continues until an unvisited object is found and evicted. After eviction, the hand moves to the next position.


<figure markdown>
  <div style="display:flex;">
    <img src="../../../../assets/sieve/sieve-diagram.png" alt="figure-sieve-efficiency-small" style="width:500px;" />
  </div>
  <figcaption>An iilustration of SIEVE</figcaption>
</figure>

### SIEVE's Real-World Impact: A Performance Breakdown

SIEVE's practicality shines in its real-world application. 

#### Efficiency
Our comprehensive evaluation, involving over 1559 traces from diverse datasets that together contain 247,017 million requests to 14,852 million objects, positions SIEVE as a frontrunner.

In the larger cache sizes, SIEVE is a clear leader, significantly reducing miss ratios in comparison to FIFO. For instance, in the CDN1 dataset, it trumps FIFO’s miss ratio by more than 42% on some traces, with an average reduction of 21%. Even against sophisticated algorithms like ARC, SIEVE holds its ground, reducing ARC’s miss ratio by up to 63.2%.

While SIEVE excels with large caches, it faces competition at smaller sizes from algorithms like TwoQ and LHD. This is due to their ability to quickly discard low-value objects, a challenge for SIEVE when cache space is limited. However, at larger cache sizes, where real-world applications often operate, SIEVE consistently outperforms its peers.


<figure markdown>
  <div style="display:flex;">
    <img src="../../../../assets/sieve/efficiency-large.png" alt="figure-sieve-efficiency-large" style="width:300px; margin-right:20px;" />
    <img src="../../../../assets/sieve/efficiency-small.png" alt="figure-sieve-efficiency-small" style="width:300px;" />
  </div>
  <!-- <figcaption>Image caption</figcaption> -->
</figure>

#### Throughput
Besides efficiency, throughput is the other important metric for caching systems. Although we have implemented SIEVE in five different libraries, we focus on Cachelib’s results.

In Cachelib, LRU and TwoQ have been tweaked for better scalability. With smart moves like limiting promotion frequency and introducing lock combining, we've seen a 6× increase in throughput at 16 threads, a significant jump from just one thread on the Twitter trace. On the other hand, the classic, unoptimized LRU hits its limit at 4 threads.

SIEVE takes a different approach, eliminating the need for promotion with each cache hit. This simplicity pays off. On a single thread, SIEVE is 16% faster than the spruced-up LRU and 17% quicker than TwoQ on both traces. When ramped up to 16 threads, SIEVE's throughput more than doubles compared to these algorithms on the Meta trace, showcasing its effortless scalability.

<figure markdown>
  <div style="display:flex;">
    <img src="../../../../assets/sieve/throughput.png" alt="figure-sieve-efficiency-small" style="width:600px;" />
  </div>
  <!-- <figcaption>An iilustration of SIEVE</figcaption> -->
</figure>

#### Simplicity
When it comes to simplicity, SIEVE really takes the cake. We delved into the most popular cache libraries and systems across five diverse programming languages: C++, Go, JavaScript, Python, and Rust. Our mission? To swap out the traditional LRU/FIFO with SIEVE.

Despite the varied ways LRU is implemented across these libraries - some opt for doubly-linked lists, others for arrays - integrating SIEVE turned out to be a breeze. Whether it's the structural differences or the coding style, SIEVE slotted in smoothly. As illustrated in the Table, the required code changes to replace LRU with SIEVE were minimal. In all cases, it took no more than 21 lines of code modifications (tests not included). This highlights SIEVE's simplicity and ease of integration in diverse coding environments.

| Cache library | Language   | Lines   | Hour of Work   |
| :---------: | :---------: |:---------: | :---------: |
| `groupcache`       | Golang  | 21  |Golang  |  <1  |
| `mnemonist`       | Javascript |12  |Golang  |  1  |
| `lru-rs`    | Rust | 16  |  1  |
| `lru-rs`    | Python + C | 21  | <1  |

### SIEVE: Beyond a Mere Eviction Algorithm

SIEVE isn't just playing the part of a cache eviction algorithm anymore; it's stepping up as a cache design superstar. Think of it like giving a fresh spin to classics. We've plugged SIEVE into fan-favorites like LeCaR, TwoQ, and ARC, swapping out their old LRU hearts for a SIEVE one. And guess what? This little switcheroo is working wonders!

Swapping LRU with SIEVE in these algorithms isn't just a minor tweak; it's more like giving them a turbo boost. Take ARC-SIEVE, for instance – it's turning heads with its slick efficiency, especially noticeable across different cache sizes.
We didn't stop there. We pushed SIEVE a bit further by letting it peek into the future – well, sort of. We tested how well it could guess the next request. It turns out, with this extra bit of foresight, SIEVE is nailing it, outperforming the rest in almost all scenarios.

<figure markdown>
  <div style="display:flex;">
    <img src="../../../../assets/sieve/sieve_queue_all_large.svg" alt="figure-sieve-efficiency-small" style="width:400px;" />
  </div>
  <!-- <figcaption>An iilustration of SIEVE</figcaption> -->
</figure>

## Conclusion: Embracing the Future with SIEVE
As we conclude this journey through the intricacies of SIEVE, it's clear that this algorithm isn't just a step forward in caching technology—it's a leap into a future where digital experiences are faster and more efficient. Whether you're a developer, researcher, or tech aficionado, SIEVE offers exciting possibilities for innovation in web caching.

