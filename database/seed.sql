USE coding_tracker;

-- Default password for all seeded users: password
SET @seed_password_hash = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

INSERT INTO users (name, email, password_hash, role) VALUES
  ('Admin Zero', 'admin@tracker.dev', @seed_password_hash, 'admin'),
  ('Ava Byte', 'ava@tracker.dev', @seed_password_hash, 'user'),
  ('Liam Loop', 'liam@tracker.dev', @seed_password_hash, 'user'),
  ('Mia Stack', 'mia@tracker.dev', @seed_password_hash, 'user'),
  ('Noah Logic', 'noah@tracker.dev', @seed_password_hash, 'user');

INSERT INTO problems (title, description, difficulty, topic, reference_url, created_by) VALUES
  ('Two Sum Variant', 'Find two numbers whose indices sum to a target using an efficient approach.', 'easy', 'Arrays', 'https://leetcode.com/problems/two-sum/', 1),
  ('Valid Parentheses Stream', 'Validate a stream of brackets while preserving linear complexity and using a stack.', 'easy', 'Stack', 'https://leetcode.com/problems/valid-parentheses/', 1),
  ('Merge Intervals Extended', 'Merge overlapping intervals and return normalized ranges sorted by starting index.', 'medium', 'Intervals', 'https://leetcode.com/problems/merge-intervals/', 1),
  ('Binary Tree Right View', 'Return the visible nodes when looking at a binary tree from the right side.', 'medium', 'Trees', 'https://leetcode.com/problems/binary-tree-right-side-view/', 1),
  ('Longest Substring Without Repeating', 'Compute the longest substring with unique characters using a sliding window.', 'medium', 'Sliding Window', 'https://leetcode.com/problems/longest-substring-without-repeating-characters/', 1),
  ('K Closest Points to Origin', 'Return k points closest to the origin using a heap or quickselect strategy.', 'medium', 'Heap', 'https://leetcode.com/problems/k-closest-points-to-origin/', 1),
  ('Word Ladder Reachability', 'Given two words, compute shortest transformation sequence length through dictionary neighbors.', 'hard', 'Graph', 'https://leetcode.com/problems/word-ladder/', 1),
  ('LRU Cache Design', 'Implement an LRU cache supporting O(1) get/put operations.', 'hard', 'Design', 'https://leetcode.com/problems/lru-cache/', 1),
  ('Daily Temperatures', 'For each day, return how many days to wait for a warmer temperature.', 'medium', 'Monotonic Stack', 'https://leetcode.com/problems/daily-temperatures/', 1),
  ('Top K Frequent Elements', 'Return the k most frequent elements from an integer array.', 'medium', 'Hash Map', 'https://leetcode.com/problems/top-k-frequent-elements/', 1);

INSERT INTO daily_problems (problem_date, problem_id, created_by) VALUES
  (DATE_SUB(UTC_DATE(), INTERVAL 9 DAY), 1, 1),
  (DATE_SUB(UTC_DATE(), INTERVAL 8 DAY), 2, 1),
  (DATE_SUB(UTC_DATE(), INTERVAL 7 DAY), 3, 1),
  (DATE_SUB(UTC_DATE(), INTERVAL 6 DAY), 4, 1),
  (DATE_SUB(UTC_DATE(), INTERVAL 5 DAY), 5, 1),
  (DATE_SUB(UTC_DATE(), INTERVAL 4 DAY), 6, 1),
  (DATE_SUB(UTC_DATE(), INTERVAL 3 DAY), 7, 1),
  (DATE_SUB(UTC_DATE(), INTERVAL 2 DAY), 8, 1),
  (DATE_SUB(UTC_DATE(), INTERVAL 1 DAY), 9, 1),
  (UTC_DATE(), 10, 1);

INSERT INTO notes (user_id, title, content) VALUES
  (2, 'Sliding Window Reminders', 'Track left and right pointers carefully and update frequency maps when shrinking.'),
  (2, 'Tree Traversal', 'Practice BFS and DFS for right-side view style problems.'),
  (3, 'Heap Practice', 'Need to review heapify and comparator behavior in JS.'),
  (4, 'Graph Notes', 'Word ladder adjacency generation can be optimized with wildcard patterns.'),
  (5, 'Consistency Goal', 'Complete one problem every day before 9 PM.');

INSERT INTO user_completions (user_id, daily_problem_id, completion_date)
SELECT 2, id, problem_date
FROM daily_problems
WHERE problem_date BETWEEN DATE_SUB(UTC_DATE(), INTERVAL 6 DAY) AND UTC_DATE();

INSERT INTO user_completions (user_id, daily_problem_id, completion_date)
SELECT 3, id, problem_date
FROM daily_problems
WHERE problem_date BETWEEN DATE_SUB(UTC_DATE(), INTERVAL 8 DAY) AND DATE_SUB(UTC_DATE(), INTERVAL 1 DAY);

INSERT INTO user_completions (user_id, daily_problem_id, completion_date)
SELECT 4, id, problem_date
FROM daily_problems
WHERE problem_date IN (
  DATE_SUB(UTC_DATE(), INTERVAL 9 DAY),
  DATE_SUB(UTC_DATE(), INTERVAL 7 DAY),
  DATE_SUB(UTC_DATE(), INTERVAL 4 DAY),
  DATE_SUB(UTC_DATE(), INTERVAL 2 DAY)
);

INSERT INTO user_completions (user_id, daily_problem_id, completion_date)
SELECT 5, id, problem_date
FROM daily_problems
WHERE problem_date IN (DATE_SUB(UTC_DATE(), INTERVAL 1 DAY), UTC_DATE());
