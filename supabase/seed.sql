insert into public.recipes (slug, name, description, ingredients, instructions, image_url, tags)
values
  (
    'smoky-chickpea-stew',
    'Smoky Chickpea Stew',
    'A hearty, smoky tomato-based stew with chickpeas, roasted peppers, and greens.',
    '1 tbsp olive oil
1 yellow onion, diced
3 cloves garlic, minced
1 roasted red pepper, sliced
2 cups cooked chickpeas
1 can (14 oz) crushed tomatoes
2 cups vegetable broth
1 tsp smoked paprika
1 tsp ground cumin
1/2 tsp chili flakes
2 cups chopped kale
Salt and pepper to taste',
    '1. Warm olive oil in a dutch oven over medium heat. Add onion and cook until translucent.
2. Stir in garlic, roasted pepper, chickpeas, smoked paprika, cumin, and chili flakes; cook 2 minutes.
3. Pour in crushed tomatoes and broth. Simmer 15 minutes.
4. Fold in kale and cook until wilted. Season with salt and pepper. Serve hot.',
    'https://images.unsplash.com/photo-1481931715705-36f9091d1661?auto=format&fit=crop&w=800&q=80',
    array['vegan', 'comfort', '30-minute']
  ),
  (
    'summer-panzanella',
    'Summer Panzanella',
    'A bright Italian bread salad with juicy tomatoes, cucumbers, and basil tossed in a garlicky vinaigrette.',
    '4 cups day-old sourdough, cubed
1/4 cup olive oil
1 clove garlic, grated
3 large heirloom tomatoes, chopped
1 cucumber, sliced
1/2 red onion, thinly sliced
1/4 cup capers, rinsed
1/2 cup fresh basil leaves
2 tbsp red wine vinegar
Salt and black pepper to taste',
    '1. Toss bread cubes with half the olive oil and toast in a skillet until crisp.
2. Combine tomatoes, cucumber, onion, capers, and basil in a large bowl.
3. Whisk remaining olive oil with garlic and vinegar; season with salt and pepper.
4. Add toasted bread to vegetables, drizzle dressing, toss to coat, and let rest 10 minutes before serving.',
    'https://images.unsplash.com/photo-1473093226795-af9932fe5856?auto=format&fit=crop&w=800&q=80',
    array['vegetarian', 'salad', 'summer']
  ),
  (
    'miso-butter-salmon',
    'Miso Butter Salmon',
    'Roasted salmon fillets glazed with a savory miso butter and served with quick pickled cucumbers.',
    '4 salmon fillets
2 tbsp white miso paste
2 tbsp softened butter
1 tbsp maple syrup
1 tbsp soy sauce
1 tsp grated ginger
Juice of 1/2 lemon
2 cups cooked rice, for serving
1 cucumber, thinly sliced
2 tbsp rice vinegar
1 tsp sesame oil
Sesame seeds and scallions for garnish',
    '1. Heat oven to 400°F (205°C). Line a sheet pan with parchment.
2. Stir miso, butter, maple syrup, soy sauce, ginger, and lemon juice into a smooth glaze.
3. Arrange salmon on the pan, spread glaze over fillets, and roast 10-12 minutes until flaky.
4. Toss cucumber with rice vinegar, sesame oil, and a pinch of salt; let marinate while salmon cooks.
5. Serve salmon over rice with pickled cucumbers, scallions, and sesame seeds.',
    'https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&fit=crop&w=800&q=80',
    array['seafood', 'weeknight', 'gluten-free']
  )
on conflict (slug) do nothing;
