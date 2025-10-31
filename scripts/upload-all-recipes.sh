#!/bin/bash

# Upload all recipes with images to API endpoint

yarn ts-node scripts/upload-recipe.ts data/recipes/beef-broccoli-stir-fry/beef-broccoli-stir-fry.yaml && echo "beef-broccoli-stir-fry ok" || echo "beef-broccoli-stir-fry failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/black-bean-enchiladas/black-bean-enchiladas.yaml && echo "black-bean-enchiladas ok" || echo "black-bean-enchiladas failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/buffalo-cauliflower-wraps/buffalo-cauliflower-wraps.yaml && echo "buffalo-cauliflower-wraps ok" || echo "buffalo-cauliflower-wraps failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/caprese-stuffed-portobellos/caprese-stuffed-portobellos.yaml && echo "caprese-stuffed-portobellos ok" || echo "caprese-stuffed-portobellos failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/chickpea-tikka-masala/chickpea-tikka-masala.yaml && echo "chickpea-tikka-masala ok" || echo "chickpea-tikka-masala failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/classic-beef-tacos/classic-beef-tacos.yaml && echo "classic-beef-tacos ok" || echo "classic-beef-tacos failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/coconut-curry-ramen/coconut-curry-ramen.yaml && echo "coconut-curry-ramen ok" || echo "coconut-curry-ramen failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/creamy-mushroom-risotto/creamy-mushroom-risotto.yaml && echo "creamy-mushroom-risotto ok" || echo "creamy-mushroom-risotto failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/falafel-mezze-plates/falafel-mezze-plates.yaml && echo "falafel-mezze-plates ok" || echo "falafel-mezze-plates failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/fried-potatoes-with-pancetta-and-mushrooms/fried-potatoes-with-pancetta-and-mushrooms.yaml && echo "fried-potatoes-with-pancetta-and-mushrooms ok" || echo "fried-potatoes-with-pancetta-and-mushrooms failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/garlic-butter-shrimp-scampi/garlic-butter-shrimp-scampi.yaml && echo "garlic-butter-shrimp-scampi ok" || echo "garlic-butter-shrimp-scampi failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/gochujang-glazed-chicken-thighs/gochujang-glazed-chicken-thighs.yaml && echo "gochujang-glazed-chicken-thighs ok" || echo "gochujang-glazed-chicken-thighs failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/greek-stuffed-peppers/greek-stuffed-peppers.yaml && echo "greek-stuffed-peppers ok" || echo "greek-stuffed-peppers failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/lemon-garlic-salmon/lemon-garlic-salmon.yaml && echo "lemon-garlic-salmon ok" || echo "lemon-garlic-salmon failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/lentil-bolognese/lentil-bolognese.yaml && echo "lentil-bolognese ok" || echo "lentil-bolognese failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/margherita-pizza/margherita-pizza.yaml && echo "margherita-pizza ok" || echo "margherita-pizza failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/mediterranean-quinoa-bowl/mediterranean-quinoa-bowl.yaml && echo "mediterranean-quinoa-bowl ok" || echo "mediterranean-quinoa-bowl failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/panko-crusted-cod/panko-crusted-cod.yaml && echo "panko-crusted-cod ok" || echo "panko-crusted-cod failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/roasted-red-pepper-pasta/roasted-red-pepper-pasta.yaml && echo "roasted-red-pepper-pasta ok" || echo "roasted-red-pepper-pasta failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/spinach-ricotta-stuffed-shells/spinach-ricotta-stuffed-shells.yaml && echo "spinach-ricotta-stuffed-shells ok" || echo "spinach-ricotta-stuffed-shells failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/sweet-potato-black-bean-tacos/sweet-potato-black-bean-tacos.yaml && echo "sweet-potato-black-bean-tacos ok" || echo "sweet-potato-black-bean-tacos failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/teriyaki-chicken-bowls/teriyaki-chicken-bowls.yaml && echo "teriyaki-chicken-bowls ok" || echo "teriyaki-chicken-bowls failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/veggie-pad-thai/veggie-pad-thai.yaml && echo "veggie-pad-thai ok" || echo "veggie-pad-thai failed"
yarn ts-node scripts/upload-recipe.ts data/recipes/weeknight-beef-chili/weeknight-beef-chili.yaml && echo "weeknight-beef-chili ok" || echo "weeknight-beef-chili failed"

