import { render, screen } from '@testing-library/react';
import { RecipePreviewCard } from '../recipe-preview-card';
import type { GeneratedRecipe } from '@/types/recipes';

// Mock hooks used by RecipeFeedCard
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

jest.mock('@/hooks/useFavorites', () => ({
  useFavorites: jest.fn(() => ({
    isFavorite: false,
    toggleFavorite: jest.fn(),
  })),
}));

describe('RecipePreviewCard', () => {
  const mockRecipe: GeneratedRecipe = {
    slug: 'test-recipe',
    name: 'Test Recipe',
    description: 'A test recipe',
    tags: ['test', 'recipe'],
    image_url: null,
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    title: 'Test Recipe',
    summary: 'A test recipe',
    ingredients: [],
    instructions: [],
    servings: 4,
  };

  it('should render title when available', () => {
    render(<RecipePreviewCard recipe={mockRecipe} />);
    expect(screen.getByText('Test Recipe')).toBeInTheDocument();
  });

  it('should render description when available', () => {
    render(<RecipePreviewCard recipe={mockRecipe} />);
    expect(screen.getByText('A test recipe')).toBeInTheDocument();
  });

  it('should render tags when available', () => {
    render(<RecipePreviewCard recipe={mockRecipe} />);
    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('recipe')).toBeInTheDocument();
  });

  it('should handle missing description gracefully', () => {
    const recipeWithoutDesc = { ...mockRecipe, description: null, summary: null };
    render(<RecipePreviewCard recipe={recipeWithoutDesc} />);
    expect(screen.getByText('Test Recipe')).toBeInTheDocument();
  });

  it('should handle empty tags array', () => {
    const recipeWithoutTags = { ...mockRecipe, tags: [] };
    render(<RecipePreviewCard recipe={recipeWithoutTags} />);
    expect(screen.getByText('Test Recipe')).toBeInTheDocument();
  });

  it('should show loading state for missing image', () => {
    const recipeWithoutImage = { ...mockRecipe, image_url: null };
    render(<RecipePreviewCard recipe={recipeWithoutImage} />);
    // RecipeFeedCard handles null image with shimmer effect
    const card = screen.getByText('Test Recipe').closest('a');
    expect(card).toBeInTheDocument();
  });

  it('should show streaming indicator when isStreaming is true', () => {
    render(<RecipePreviewCard recipe={mockRecipe} isStreaming={true} />);
    // When recipe has data, it shows "Streaming..." not "Generating recipe..."
    expect(screen.getByText('Streaming...')).toBeInTheDocument();
  });

  it('should not show streaming indicator when isStreaming is false', () => {
    render(<RecipePreviewCard recipe={mockRecipe} isStreaming={false} />);
    expect(screen.queryByText('Generating recipe...')).not.toBeInTheDocument();
    expect(screen.queryByText('Streaming...')).not.toBeInTheDocument();
  });

  it('should use title as fallback for name', () => {
    const recipeWithoutName = { ...mockRecipe, name: '', title: 'Fallback Title' };
    render(<RecipePreviewCard recipe={recipeWithoutName} />);
    expect(screen.getByText('Fallback Title')).toBeInTheDocument();
  });

  it('should use summary as fallback for description', () => {
    const recipeWithSummary = { ...mockRecipe, description: null, summary: 'Summary text' };
    render(<RecipePreviewCard recipe={recipeWithSummary} />);
    expect(screen.getByText('Summary text')).toBeInTheDocument();
  });

  it('should handle partial recipe with only title', () => {
    const partialRecipe: Partial<GeneratedRecipe> = {
      slug: 'partial',
      title: 'Partial Recipe',
      name: 'Partial Recipe',
      description: null,
      tags: [],
      image_url: null,
      ingredients: [],
      instructions: [],
    };
    render(<RecipePreviewCard recipe={partialRecipe as GeneratedRecipe} />);
    expect(screen.getByText('Partial Recipe')).toBeInTheDocument();
  });
});

