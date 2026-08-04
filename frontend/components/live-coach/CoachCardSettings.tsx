"use client";

import { useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Lightbulb,
  AlertCircle,
  HelpCircle,
  Target,
  Compass,
  Loader2,
  X,
} from "lucide-react";
import {
  useCoachCards,
  useCreateCoachCard,
  useUpdateCoachCard,
  useDeleteCoachCard,
} from "@/hooks/api/useLiveCoach";

type CardCategory = "objection" | "question" | "closing" | "discovery" | "general";

interface CoachCardFormData {
  title: string;
  category: CardCategory;
  triggerPhrases: string[];
  content: string;
  tips: string[];
}

export function CoachCardSettings() {
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [formData, setFormData] = useState<CoachCardFormData>({
    title: "",
    category: "general",
    triggerPhrases: [],
    content: "",
    tips: [],
  });
  const [newPhrase, setNewPhrase] = useState("");
  const [newTip, setNewTip] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CardCategory | "all">("all");

  const { data: cards, isLoading } = useCoachCards(
    categoryFilter === "all" ? {} : { category: categoryFilter }
  );
  const createCard = useCreateCoachCard();
  const updateCard = useUpdateCoachCard();
  const deleteCard = useDeleteCoachCard();

  const getCategoryIcon = (category: CardCategory) => {
    switch (category) {
      case "objection":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "question":
        return <HelpCircle className="w-4 h-4 text-blue-500" />;
      case "closing":
        return <Target className="w-4 h-4 text-green-500" />;
      case "discovery":
        return <Compass className="w-4 h-4 text-purple-500" />;
      default:
        return <Lightbulb className="w-4 h-4 text-amber-500" />;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCard) {
        await updateCard.mutateAsync({ id: editingCard, ...formData });
      } else {
        await createCard.mutateAsync(formData);
      }
      resetForm();
    } catch (error) {
      console.error("Failed to save coach card:", error);
    }
  };

  const handleEdit = (card: {
    id: string;
    title: string;
    category: string;
    triggerPhrases: string[];
    content: string;
    tips: string[];
  }) => {
    setEditingCard(card.id);
    setFormData({
      title: card.title,
      category: card.category as CardCategory,
      triggerPhrases: card.triggerPhrases,
      content: card.content,
      tips: card.tips || [],
    });
    setShowForm(true);
  };

  const handleDelete = async (cardId: string) => {
    if (!confirm("Are you sure you want to delete this coach card?")) return;
    try {
      await deleteCard.mutateAsync(cardId);
    } catch (error) {
      console.error("Failed to delete coach card:", error);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingCard(null);
    setFormData({
      title: "",
      category: "general",
      triggerPhrases: [],
      content: "",
      tips: [],
    });
    setNewPhrase("");
    setNewTip("");
  };

  const addPhrase = () => {
    if (newPhrase.trim() && !formData.triggerPhrases.includes(newPhrase.trim())) {
      setFormData({
        ...formData,
        triggerPhrases: [...formData.triggerPhrases, newPhrase.trim()],
      });
      setNewPhrase("");
    }
  };

  const removePhrase = (phrase: string) => {
    setFormData({
      ...formData,
      triggerPhrases: formData.triggerPhrases.filter((p) => p !== phrase),
    });
  };

  const addTip = () => {
    if (newTip.trim() && !formData.tips.includes(newTip.trim())) {
      setFormData({
        ...formData,
        tips: [...formData.tips, newTip.trim()],
      });
      setNewTip("");
    }
  };

  const removeTip = (tip: string) => {
    setFormData({
      ...formData,
      tips: formData.tips.filter((t) => t !== tip),
    });
  };

  const isSubmitting = createCard.isPending || updateCard.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">AI Coach Cards</h2>
          <p className="text-sm text-muted-foreground">
            Configure cards that appear during calls based on trigger phrases
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-md hover:bg-foreground/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Card
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2">
        {(["all", "objection", "question", "closing", "discovery", "general"] as const).map(
          (cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-sm rounded-md capitalize transition-colors ${
                categoryFilter === cat
                  ? "bg-foreground text-background"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {cat}
            </button>
          )
        )}
      </div>

      {/* Cards list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !cards?.data?.length ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <Lightbulb className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">No coach cards configured yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 text-sm text-foreground hover:underline"
          >
            Create your first card
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {cards.data.map((card) => (
            <div
              key={card.id}
              className="bg-card border border-border rounded-lg p-4 hover:border-foreground/20 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(card.category as CardCategory)}
                  <div>
                    <h4 className="font-medium">{card.title}</h4>
                    <span className="text-xs text-muted-foreground capitalize">
                      {card.category}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(card)}
                    className="p-1.5 hover:bg-muted rounded-md transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(card.id)}
                    className="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-md transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {card.content}
              </p>

              <div className="flex flex-wrap gap-1">
                {card.triggerPhrases.slice(0, 3).map((phrase) => (
                  <span
                    key={phrase}
                    className="px-2 py-0.5 text-xs bg-muted rounded-full"
                  >
                    &quot;{phrase}&quot;
                  </span>
                ))}
                {card.triggerPhrases.length > 3 && (
                  <span className="px-2 py-0.5 text-xs text-muted-foreground">
                    +{card.triggerPhrases.length - 3} more
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-medium">
                {editingCard ? "Edit Coach Card" : "Create Coach Card"}
              </h3>
              <button
                onClick={resetForm}
                className="p-1.5 hover:bg-muted rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="e.g., Price Objection Handler"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:border-foreground/40"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      category: e.target.value as CardCategory,
                    })
                  }
                  className="w-full px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:border-foreground/40"
                >
                  <option value="objection">Objection</option>
                  <option value="question">Question</option>
                  <option value="closing">Closing</option>
                  <option value="discovery">Discovery</option>
                  <option value="general">General</option>
                </select>
              </div>

              {/* Trigger phrases */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Trigger Phrases
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newPhrase}
                    onChange={(e) => setNewPhrase(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPhrase())}
                    placeholder="e.g., too expensive"
                    className="flex-1 px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:border-foreground/40"
                  />
                  <button
                    type="button"
                    onClick={addPhrase}
                    className="px-4 py-2 bg-foreground text-background rounded-md hover:bg-foreground/90"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.triggerPhrases.map((phrase) => (
                    <span
                      key={phrase}
                      className="flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-sm"
                    >
                      &quot;{phrase}&quot;
                      <button
                        type="button"
                        onClick={() => removePhrase(phrase)}
                        className="hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium mb-1">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  placeholder="The main coaching content that will be displayed..."
                  rows={4}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:border-foreground/40 resize-none"
                  required
                />
              </div>

              {/* Tips */}
              <div>
                <label className="block text-sm font-medium mb-1">Tips (optional)</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newTip}
                    onChange={(e) => setNewTip(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTip())}
                    placeholder="Add a quick tip..."
                    className="flex-1 px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:border-foreground/40"
                  />
                  <button
                    type="button"
                    onClick={addTip}
                    className="px-4 py-2 bg-foreground text-background rounded-md hover:bg-foreground/90"
                  >
                    Add
                  </button>
                </div>
                <ul className="space-y-1">
                  {formData.tips.map((tip) => (
                    <li
                      key={tip}
                      className="flex items-center justify-between px-3 py-2 bg-muted rounded-md text-sm"
                    >
                      <span>• {tip}</span>
                      <button
                        type="button"
                        onClick={() => removeTip(tip)}
                        className="hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm bg-muted rounded-md hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !formData.title ||
                    !formData.content ||
                    formData.triggerPhrases.length === 0
                  }
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-foreground text-background rounded-md hover:bg-foreground/90 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingCard ? "Update Card" : "Create Card"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
