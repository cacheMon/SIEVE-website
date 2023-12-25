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

On the flip side, simpler eviction methods, though maybe not as flashy in managing cache, have a knack for improving system throughput and scalability. Just look at examples like [MemC3](https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/fan) and [Segcache](https://www.usenix.org/conference/nsdi21/presentation/yang-juncheng). They rely on straightforward approaches like FIFO and manage to significantly boost system performance. It turns out, sometimes, the best move is to keep things uncomplicated!

## Meet SIEVE: The Harmony of Simplicity and Efficiency
SIEVE is an algorithm that decides what to keep in the cache and what to discard. But unlike its predecessors, it does this with a flair for simplicity and efficiency.

### A Technical Walkthrough of SIEVE
SIEVE is built on a FIFO queue, supplemented by a "hand" pointer that navigates through the cache. Each object in the queue has a bit indicating whether it's been visited. 
On a cache hit, SIEVE marks the object as visited. 
On a cache miss, SIEVE checks the object pointed to by the hand. If the object has been visited, its visited bit is reset, and the hand moves to the next position, keeping the retained object in its original position in the queue. 
This continues until an unvisited object is found and evicted. After eviction, the hand moves to the next position.

<figure markdown>
  <div style="display:flex;">
    <img src="../../../../assets/sieve/sieve_diagram_animation.gif" alt="sieve-diagram-gif" style="width:550px;" />
  </div>
  <figcaption>An iilustration of SIEVE</figcaption>
</figure>

At first glance, SIEVE is similar to CLOCK/Second Chance/FIFO-Reinsertion - *Note that they are different
implementations of the same eviction algorithm*.
Each algorithm maintains a single queue in which each object is associated with a visited bit to track its access status. 
Visited objects are retained (also called "survived") during an eviction. Notably, new objects are inserted at the head of the queue in both SIEVE and FIFO-Reinsertion. 
However, the hand in SIEVE moves from the tail to the head over time, whereas the hand in FIFO-Reinsertion stays at the tail. 
**The key difference is where a retained object is kept.** SIEVE keeps it in the old position, while FIFO-Reinsertion inserts it at the head, together with newly inserted objects.

<figure markdown>
  <div style="display:flex;">
    <img src="../../../../assets/sieve/sieve-diagram.png" alt="figure-sieve-efficiency-small" style="width:550px;" />
  </div>
  <figcaption>SIEVE vs. CLOCK</figcaption>
</figure>

<!-- ```bash title="SIEVE pseudocode"
Input: The request x, doubly-linked queue T, cache size C, hand p
1: if x is in T then                            # Cache Hit
2:     x.visited <- true
3: else                                         # Cache Miss
4:     if |T| = C then                          # Cache Full
5:         obj <- p
6:         if obj is NULL then
7:             obj <- tail of T
8:         while obj.visited = true do
9:             obj.visited <- false
10:            obj <- obj.prev
11:            if obj is NULL then
12:                obj <- tail of T
13:        p <- obj.prev
14:        Discard obj in T                     # Eviction
15:    Insert x in the head of T
16:    x.visited <- false                       # Insertion
``` -->

For anyone interested, see the [sieve cache implementation code](#sieve-cache-code) at the end of this blog post for a detailed example.

### SIEVE's Real-World Impact: A Performance Breakdown

SIEVE's practicality shines in its real-world application. 

#### Efficiency
Our evaluation, involving over 1559 traces from diverse datasets that together contain 247,017 million requests to 14,852 million objects, show that SIEVE outperforms all state-of-the-art eviction algorithms on more than 45% of the traces.

The following figure shows the miss ratio reduction (from FIFO) of different algorithms across traces. The whiskers on the boxplots are defined using p10 and p90, allowing us to disregard extreme data
and concentrate on the typical cases.
SIEVE demonstrates the most significant reductions across
nearly all percentiles.
For example, SIEVE reduces FIFO’s miss ratio by more than 42% on 10% of the traces (top whisker) with a mean of 21% on the one of the largest CDN company dataset. 
As a comparison, all other algorithms have smaller reductions on this dataset.
Compared to advanced algorithms, e.g., ARC, SIEVE reduces
ARC miss ratio by up to 63.2% with a mean of 1.5%.


<!-- While SIEVE excels with large caches, it faces competition at smaller sizes from algorithms like TwoQ and LHD. This is due to their ability to quickly discard low-value objects, a challenge for SIEVE when cache space is limited. However, at larger cache sizes, where real-world applications often operate, SIEVE consistently outperforms its peers. -->


<figure markdown>
  <div style="display:flex;">
    <img src="../../../../assets/sieve/efficiency-large.png" alt="figure-sieve-efficiency-large" style="width:500px; margin-right:20px;" />
    <!-- <img src="../../../../assets/sieve/efficiency-small.png" alt="figure-sieve-efficiency-small" style="width:300px;" /> -->
  </div>
  <!-- <figcaption>Image caption</figcaption> -->
</figure>

#### Simplicity
SIEVE is very simple. We delved into the most popular cache libraries and systems across five diverse programming languages: C++, Go, JavaScript, Python, and Rust. 

Despite the varied ways LRU is implemented across these libraries - some opt for doubly-linked lists, others for arrays - integrating SIEVE turned out to be a breeze. Whether it's the structural differences or the coding style, SIEVE slotted in smoothly. As illustrated in the Table, the required code changes to replace LRU with SIEVE were minimal. In all cases, it took no more than 21 lines of code modifications (tests not included).

<figure markdown>

| Cache library | Language   | Lines   | Hour of Work   |
| :---------: | :---------: |:---------: | :---------: |
| [groupcache](https://github.com/cacheMon/groupcache) | Golang  | 21  | <1  |
| [mnemonist](https://github.com/cacheMon/mnemonist) | Javascript |12  |  1  |
| [lru-rs](https://github.com/cacheMon/lru-rs) | Rust | 16  |  1  |
| [lru-dict](https://github.com/cacheMon/lru-dict)| Python + C | 21  | <1  |

</figure>

#### Throughput
Besides efficiency, throughput is the other important metric for caching systems. Although we have implemented SIEVE in five different libraries, we focus on Cachelib’s results.

Compared to these LRU-based algorithms, SIEVE does not require “promotion” at each cache hit. Therefore, it is faster and more scalable.
At a single thread, SIEVE is 16% (17%) faster than the optimized LRU (TwoQ) and on the tested traces.
At 16 threads, SIEVE shows more than 2× higher throughput than the optimized LRU and TwoQ.

<!-- In Cachelib, LRU and TwoQ have been tweaked for better scalability. With smart moves like limiting promotion frequency and introducing lock combining, we've seen a 6× increase in throughput at 16 threads, a significant jump from just one thread on the Twitter trace. On the other hand, the classic, unoptimized LRU hits its limit at 4 threads.

SIEVE takes a different approach, eliminating the need for promotion with each cache hit. This simplicity pays off. On a single thread, SIEVE is 16% faster than the spruced-up LRU and 17% quicker than TwoQ on both traces. When ramped up to 16 threads, SIEVE's throughput more than doubles compared to these algorithms on the Meta trace, showcasing its effortless scalability. -->




### SIEVE is beyond an eviction algorithm

SIEVE isn't just playing the part of a cache eviction algorithm; it's stepping up as a cache design superstar. Think of it like giving a fresh spin to classics. We've plugged SIEVE into [LeCaR](https://www.usenix.org/conference/hotstorage18/presentation/vietri), [TwoQ](https://www.vldb.org/conf/1994/P439.PDF), [ARC](https://www.usenix.org/conference/fast-03/arc-self-tuning-low-overhead-replacement-cache), and [S3-FIFO](https://dl.acm.org/doi/10.1145/3600006.3613147), swapping out their LRU or FIFO queue for a SIEVE one.

Swapping LRU with SIEVE in these algorithms isn't just a minor tweak; it's more like giving them a turbo boost. Take ARC-SIEVE, for instance – it's turning heads with its slick efficiency, especially noticeable across different cache sizes.
We didn't stop there. We pushed SIEVE a bit further by letting it peek into the future – well, sort of. We tested how well it could guess the next request. It turns out, with this extra bit of foresight, SIEVE is nailing it, outperforming the rest in almost all scenarios.

<figure markdown>
  <div style="display:flex;">
    <img src="../../../../assets/sieve/sieve_queue_all_large.svg" alt="figure-sieve-efficiency-small" style="width:400px;" />
  </div>
  <!-- <figcaption>An iilustration of SIEVE</figcaption> -->
</figure>


### SIEVE is not scan-resistant
Besides web cache workloads, we evaluated SIEVE on
some block cache workloads. However, we find that SIEVE
sometimes shows a miss ratio higher than LRU. The primary
reason for this discrepancy is that SIEVE is not scan-resistant.
In block cache workloads, which frequently feature scans,
popular objects often intermingle with objects from scans.
Consequently, both types of objects are rapidly evicted after insertion.

[Marc's latest blog post](https://brooker.co.za/blog/2023/12/15/sieve.html) has explored the idea of making sieve scan-resistant by adding a small counter for each item.
It shows some wins and losses on different workloads.
We're really excited to see how this plays out in the real world. If you're an engineer, a tech enthusiast, or just someone who enjoys playing around with systems, we'd absolutely love for you to give SIEVE a whirl in your setups. 


## We'd Love to Hear from you
As we wrap up this blog post, we would like to give a big shoutout to the people and organizations that open-sourced and shared the traces. We believe SIEVE presents an intriguing opportunity to explore and enhance the efficiency of web caching.
**If you have questions, thoughts, or if you've given SIEVE a try, we're eager to hear from you! Don't hesitate to get in touch :-)**

## Appendix

<div id="sieve-cache-code">
```Python title="SIEVE Python Implementation"
class Node:
    def __init__(self, value):
        self.value = value
        self.visited = False
        self.prev = None
        self.next = None

class SieveCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.cache = {}  # To store cache items as {value: node}
        self.head = None
        self.tail = None
        self.hand = None
        self.size = 0

    def _add_to_head(self, node):
        node.next = self.head
        node.prev = None
        if self.head:
            self.head.prev = node
        self.head = node
        if self.tail is None:
            self.tail = node

    def _remove_node(self, node):
        if node.prev:
            node.prev.next = node.next
        else:
            self.head = node.next
        if node.next:
            node.next.prev = node.prev
        else:
            self.tail = node.prev

    def _evict(self):
        obj = self.hand if self.hand else self.tail
        while obj and obj.visited:
            obj.visited = False
            obj = obj.prev if obj.prev else self.tail
        self.hand = obj.prev if obj.prev else None
        del self.cache[obj.value]
        self._remove_node(obj)
        self.size -= 1

    def access(self, x):
        if x in self.cache:  # Cache Hit
            node = self.cache[x]
            node.visited = True
        else:  # Cache Miss
            if self.size == self.capacity:  # Cache Full
                self._evict()  # Eviction
            new_node = Node(x)
            self._add_to_head(new_node)
            self.cache[x] = new_node
            self.size += 1
            new_node.visited = False  # Insertion

    def show_cache(self):
        current = self.head
        while current:
            print(f'{current.value} (Visited: {current.visited})', end=' -> ' if current.next else '\n')
            current = current.next

# Example usage
cache = SieveCache(3)
cache.access('A')
cache.access('B')
cache.access('C')
cache.access('D')
cache.show_cache()
```
</div>