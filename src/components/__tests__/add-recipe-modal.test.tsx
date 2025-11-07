import { render, screen } from "@testing-library/react";
import { RecipeModal } from "../recipe-modal";
import { useRecipeGeneration } from "@/hooks/useRecipeGeneration";
import { useAuth } from "@/hooks/useAuth";
import { useSessionToken } from "@/hooks/useSessionToken";
import { useRecipeImage } from "@/hooks/useRecipeImage";

// Mock hooks
jest.mock("@/hooks/useRecipeGeneration");
jest.mock("@/hooks/useAuth");
jest.mock("@/hooks/useSessionToken");
jest.mock("@/hooks/useRecipeImage");

// Mock hooks used by RecipeFeedCard (used in RecipePreviewCard)
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

jest.mock("@/hooks/useFavorites", () => ({
  useFavorites: jest.fn(() => ({
    isFavorite: false,
    toggleFavorite: jest.fn(),
  })),
}));

describe("RecipeModal - Create Mode", () => {
  const mockGenerateRecipe = jest.fn();
  const mockReset = jest.fn();
  const mockSetError = jest.fn();
  const mockAddRecipe = jest.fn();
  const mockUpdateRecipeImage = jest.fn();
  const mockFetchToken = jest.fn();
  const mockGenerateImage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      session: { user: { id: "test-user" } },
      loading: false,
    });
    (useSessionToken as jest.Mock).mockReturnValue({
      fetchToken: mockFetchToken,
    });
    (useRecipeImage as jest.Mock).mockReturnValue({
      generateImage: mockGenerateImage,
    });
    (useRecipeGeneration as jest.Mock).mockReturnValue({
      generatedRecipe: null,
      isGenerating: false,
      isAdding: false,
      error: null,
      generateRecipe: mockGenerateRecipe,
      addRecipe: mockAddRecipe,
      updateRecipeImage: mockUpdateRecipeImage,
      reset: mockReset,
      setError: mockSetError,
    });
  });

  it("should show recipe card when title is received", () => {
    (useRecipeGeneration as jest.Mock).mockReturnValue({
      generatedRecipe: {
        slug: "test",
        name: "Test Recipe",
        description: null,
        tags: [],
        title: "Test Recipe",
        summary: null,
        ingredients: [],
        instructions: [],
        image_url: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        servings: null,
      },
      isGenerating: true, // Still generating
      isAdding: false,
      error: null,
      generateRecipe: mockGenerateRecipe,
      addRecipe: mockAddRecipe,
      updateRecipeImage: mockUpdateRecipeImage,
      reset: mockReset,
      setError: mockSetError,
    });

    render(<RecipeModal isOpen={true} onClose={jest.fn()} mode="create" />);

    expect(screen.getByText("Test Recipe")).toBeInTheDocument();
  });

  it('should disable "Add recipe" button until complete', () => {
    (useRecipeGeneration as jest.Mock).mockReturnValue({
      generatedRecipe: {
        slug: "test",
        name: "Test Recipe",
        title: "Test Recipe",
        description: null,
        tags: [],
        ingredients: [],
        instructions: [],
        image_url: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        servings: null,
      },
      isGenerating: true,
      isAdding: false,
      error: null,
      generateRecipe: mockGenerateRecipe,
      addRecipe: mockAddRecipe,
      updateRecipeImage: mockUpdateRecipeImage,
      reset: mockReset,
      setError: mockSetError,
    });

    render(<RecipeModal isOpen={true} onClose={jest.fn()} mode="create" />);

    const addButton = screen.getByRole("button", { name: /add recipe|generating/i });
    expect(addButton).toBeDisabled();
  });

  it('should enable "Add recipe" button when complete', () => {
    (useRecipeGeneration as jest.Mock).mockReturnValue({
      generatedRecipe: {
        slug: "test",
        name: "Test Recipe",
        title: "Test Recipe",
        summary: "A test",
        description: "A test",
        tags: ["test"],
        ingredients: [],
        instructions: [],
        image_url: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        servings: null,
      },
      isGenerating: false, // Complete
      isAdding: false,
      error: null,
      generateRecipe: mockGenerateRecipe,
      addRecipe: mockAddRecipe,
      updateRecipeImage: mockUpdateRecipeImage,
      reset: mockReset,
      setError: mockSetError,
    });

    render(<RecipeModal isOpen={true} onClose={jest.fn()} mode="create" />);

    const addButton = screen.getByRole("button", { name: /add recipe/i });
    expect(addButton).not.toBeDisabled();
  });

  it("should show loading indicator during generation", () => {
    (useRecipeGeneration as jest.Mock).mockReturnValue({
      generatedRecipe: null,
      isGenerating: true,
      isAdding: false,
      error: null,
      generateRecipe: mockGenerateRecipe,
      addRecipe: mockAddRecipe,
      updateRecipeImage: mockUpdateRecipeImage,
      reset: mockReset,
      setError: mockSetError,
    });

    render(<RecipeModal isOpen={true} onClose={jest.fn()} mode="create" />);

    // Check for loading state in form
    const generateButton = screen.getByRole("button", { name: /generating/i });
    expect(generateButton).toBeDisabled();
  });

  it("should show input form when no recipe data", () => {
    (useRecipeGeneration as jest.Mock).mockReturnValue({
      generatedRecipe: null,
      isGenerating: false,
      isAdding: false,
      error: null,
      generateRecipe: mockGenerateRecipe,
      addRecipe: mockAddRecipe,
      updateRecipeImage: mockUpdateRecipeImage,
      reset: mockReset,
      setError: mockSetError,
    });

    render(<RecipeModal isOpen={true} onClose={jest.fn()} mode="create" />);

    expect(screen.getByLabelText(/describe the recipe/i)).toBeInTheDocument();
    expect(screen.queryByText(/test recipe/i)).not.toBeInTheDocument();
  });

  it("should show streaming overlay when generating with recipe data", () => {
    (useRecipeGeneration as jest.Mock).mockReturnValue({
      generatedRecipe: {
        slug: "test",
        name: "Test Recipe",
        title: "Test Recipe",
        description: null,
        tags: [],
        ingredients: [],
        instructions: [],
        image_url: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        servings: null,
      },
      isGenerating: true,
      isAdding: false,
      error: null,
      generateRecipe: mockGenerateRecipe,
      addRecipe: mockAddRecipe,
      updateRecipeImage: mockUpdateRecipeImage,
      reset: mockReset,
      setError: mockSetError,
    });

    render(<RecipeModal isOpen={true} onClose={jest.fn()} mode="create" />);

    // When recipe has data, it shows "Streaming..." not "Generating recipe..."
    expect(screen.getByText("Streaming...")).toBeInTheDocument();
  });

  it('should show "Generating..." text on button when streaming', () => {
    (useRecipeGeneration as jest.Mock).mockReturnValue({
      generatedRecipe: {
        slug: "test",
        name: "Test Recipe",
        title: "Test Recipe",
        description: null,
        tags: [],
        ingredients: [],
        instructions: [],
        image_url: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        servings: null,
      },
      isGenerating: true,
      isAdding: false,
      error: null,
      generateRecipe: mockGenerateRecipe,
      addRecipe: mockAddRecipe,
      updateRecipeImage: mockUpdateRecipeImage,
      reset: mockReset,
      setError: mockSetError,
    });

    render(<RecipeModal isOpen={true} onClose={jest.fn()} mode="create" />);

    const button = screen.getByRole("button", { name: /generating/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });
});
