1. **Optimize O(N^2) Map loop in `getEligibleMuseumCards`**
   - The function `getEligibleMuseumCards` iterates through every owned card in the user's collection, calling `matchesMuseumCriteria(setId, cardId, criteria)` for each one.
   - Inside `matchesMuseumCriteria`, it currently does `const cached = getCachedSetCards(setId) || [];` followed by `const apiCard = cached.find(c => c.id === cardId);`, which causes an `O(N)` loop to run for every single card in the user's collection, producing O(N^2) complexity.
   - We will fix this by changing `matchesMuseumCriteria` to use `getCachedSetCardsMap(setId)` to get the card in `O(1)` time.
2. **Implement test and format before commit**
   - Run `pnpm lint` and `pnpm test` (or their equivalents) before creating PR.
3. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
4. **Present the results**
   - Use the submit tool with the Bolt persona Title and Description.
