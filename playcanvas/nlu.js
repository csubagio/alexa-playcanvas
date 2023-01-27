// lightweight nlu related helpers

function levenshteinDistance(s, t) {
  // levenshtein distance tells you how many individual
  // character changes you have to make to string s 
  // to turn it into string t. When the strings match
  // the distance is 0. When the strings aren't similar 
  // at all, the distance is the length of the longer one.
  
  // if either string is missing, the distance is 
  // the full length of the other string
  if (!s.length) return t.length;
  if (!t.length) return s.length;

  // build the matrix
  const arr = [[]];
  
  // row 1 in just ascending numbers
  for (let j = 0; j <= t.length; j++) {
    arr[0].push(j);
  }

  for (let i = 1; i <= s.length; i++) {
    // each subsequent row starts with the row index 
    arr[i] = [i];
    for (let j = 1; j <= t.length; j++) {
      // the rest are the minimum of either left or 
      // top + 1, or top left + cost, where cost 
      // is 1 if the characters aren't the same
      arr[i][j] = Math.min(
        arr[i - 1][j] + 1,
        arr[i][j - 1] + 1,
        arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1)
      );
    }
  }
  
  // answer is now at bottom right of the matrix
  return arr[s.length][t.length];
}

function normalizedLevenshtein(s, t) {
  // this version of levenshtein returns larger distances
  // when the source string is a different length 
  // from the target, where the straight levenshtein 
  // difference might be the same.
  // so     lv( apple,    appleton ) = 3
  //   and  lv( appleham, appleton ) = 3
  // while nlv( apple,    appleton ) = 0.6
  //   and nlv( appleham, appleton ) = 0.375
  let l = levenshteinDistance(s, t);
  return 1.0 * l / Math.min(s.length, t.length);
}

console.log( normalizedLevenshtein("flack", "flag"))