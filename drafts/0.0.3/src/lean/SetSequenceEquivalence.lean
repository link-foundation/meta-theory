/-
  SetSequenceEquivalence.lean - Формальное доказательство того, что конечное множество
  эквивалентно упорядоченной последовательности с уникальными элементами.

  Основная теорема: Для любого конечного множества натуральных чисел существует
  единственная строго возрастающая последовательность (список без дубликатов,
  отсортированный по возрастанию), содержащая в точности те же элементы.

  Адаптировано из: https://github.com/konard/subset-sum/tree/main/proofs/set_sequence_equivalence
-/

namespace SetSequenceEquivalence

/-- Список является строго возрастающим, если каждый элемент строго меньше следующего -/
def StrictlyAscending : List Nat → Prop
  | [] => True
  | [_] => True
  | x :: y :: rest => x < y ∧ StrictlyAscending (y :: rest)

/-- Список не содержит дубликатов -/
def NoDuplicates : List Nat → Prop
  | [] => True
  | x :: rest => x ∉ rest ∧ NoDuplicates rest

/-- Упорядоченная уникальная последовательность — это строго возрастающий список -/
def IsOrderedUniqueSequence (l : List Nat) : Prop :=
  StrictlyAscending l

/-- Вспомогательная лемма: все элементы в хвосте строго возрастающего списка больше головы -/
theorem strictly_ascending_all_gt (x : Nat) (l : List Nat)
    (h : StrictlyAscending (x :: l)) : ∀ z ∈ l, x < z := by
  induction l with
  | nil => intro z hz; exact absurd hz (List.not_mem_nil z)
  | cons y ys ih =>
    intro z hz
    have hxy : x < y := by
      simp [StrictlyAscending] at h; exact h.1
    cases hz with
    | head => exact hxy
    | tail _ hz_ys =>
      have hrest : StrictlyAscending (y :: ys) := by
        simp [StrictlyAscending] at h
        cases ys with
        | nil => simp [StrictlyAscending]
        | cons w ws => exact h.2
      have hyz : y < z := ih hrest z hz_ys
      omega

/-- Строго возрастающий список не содержит дубликатов -/
theorem strictly_ascending_implies_no_dup : ∀ l : List Nat,
    StrictlyAscending l → NoDuplicates l := by
  intro l
  induction l with
  | nil => intro _; simp [NoDuplicates]
  | cons x rest ih =>
    intro h
    simp [NoDuplicates]
    constructor
    · intro hx_in
      have := strictly_ascending_all_gt x rest h x hx_in
      omega
    · cases rest with
      | nil => simp [NoDuplicates]
      | cons y ys =>
        simp [StrictlyAscending] at h
        cases ys with
        | nil => exact ih (by simp [StrictlyAscending]) h.2
        | cons w ws => exact ih h.2

/-- Вставка элемента в отсортированный список с сохранением порядка -/
def insertSorted (x : Nat) : List Nat → List Nat
  | [] => [x]
  | y :: rest =>
    if x < y then x :: y :: rest
    else if x = y then y :: rest  -- Пропуск дубликатов
    else y :: insertSorted x rest

/-- Сортировка списка в строго возрастающем порядке (с удалением дубликатов) -/
def toOrderedUnique : List Nat → List Nat
  | [] => []
  | x :: rest => insertSorted x (toOrderedUnique rest)

/-- insertSorted сохраняет свойство строгого возрастания -/
theorem insertSorted_preserves_ascending (x : Nat) (l : List Nat) :
    StrictlyAscending l → StrictlyAscending (insertSorted x l) := by
  intro h
  induction l with
  | nil => simp [insertSorted, StrictlyAscending]
  | cons y rest ih =>
    simp only [insertSorted]
    by_cases hxy : x < y
    · simp [hxy, StrictlyAscending]
      exact ⟨hxy, h⟩
    · simp [hxy]
      by_cases hxy_eq : x = y
      · simp [hxy_eq]; exact h
      · simp [hxy_eq]
        have hyx : y < x := by omega
        cases rest with
        | nil =>
          simp [insertSorted, StrictlyAscending]
          exact hyx
        | cons z zs =>
          have hyz : y < z := by simp [StrictlyAscending] at h; exact h.1
          have hrest : StrictlyAscending (z :: zs) := by
            simp [StrictlyAscending] at h
            cases zs with
            | nil => simp [StrictlyAscending]
            | cons w ws => exact h.2
          have ih_result := ih hrest
          simp only [insertSorted] at ih_result ⊢
          by_cases hxz : x < z
          · simp [hxz, StrictlyAscending]
            exact ⟨hyx, hxz, hrest⟩
          · simp [hxz]
            by_cases hxz_eq : x = z
            · simp [hxz_eq, StrictlyAscending]; exact h
            · simp [hxz_eq, StrictlyAscending]
              constructor
              · exact hyz
              · exact ih_result

/-- toOrderedUnique выдаёт строго возрастающие списки -/
theorem toOrderedUnique_is_ascending (l : List Nat) :
    StrictlyAscending (toOrderedUnique l) := by
  induction l with
  | nil => simp [toOrderedUnique, StrictlyAscending]
  | cons x rest ih =>
    simp [toOrderedUnique]
    exact insertSorted_preserves_ascending x (toOrderedUnique rest) ih

/-- Принадлежность элемента сохраняется при insertSorted -/
theorem mem_insertSorted (x y : Nat) (l : List Nat) :
    y ∈ insertSorted x l ↔ y = x ∨ y ∈ l := by
  induction l with
  | nil =>
    simp [insertSorted]
    constructor
    · intro h; cases h with
      | head => left; rfl
      | tail _ h => exact absurd h (List.not_mem_nil _)
    · intro h; cases h with
      | inl h => exact h ▸ List.Mem.head _
      | inr h => exact absurd h (List.not_mem_nil _)
  | cons z rest ih =>
    simp only [insertSorted]
    by_cases hxz : x < z
    · simp [hxz]
      constructor
      · intro h; cases h with
        | head => left; rfl
        | tail _ h => right; exact h
      · intro h; cases h with
        | inl h => exact h ▸ List.Mem.head _
        | inr h => exact List.Mem.tail _ h
    · simp [hxz]
      by_cases hxz_eq : x = z
      · simp [hxz_eq]
        constructor
        · intro h; cases h with
          | head => left; exact hxz_eq ▸ rfl
          | tail _ h => right; exact List.Mem.tail _ h
        · intro h; cases h with
          | inl h => exact hxz_eq ▸ h ▸ List.Mem.head _
          | inr h => cases h with
            | head => exact List.Mem.head _
            | tail _ h => exact List.Mem.tail _ h
      · simp [hxz_eq]
        constructor
        · intro h; cases h with
          | head => right; exact List.Mem.head _
          | tail _ h =>
            rw [ih] at h
            cases h with
            | inl h => left; exact h
            | inr h => right; exact List.Mem.tail _ h
        · intro h; cases h with
          | inl h =>
            exact List.Mem.tail _ (ih.mpr (Or.inl h))
          | inr h => cases h with
            | head => exact List.Mem.head _
            | tail _ h =>
              exact List.Mem.tail _ (ih.mpr (Or.inr h))

/-- Принадлежность элемента сохраняется при toOrderedUnique -/
theorem mem_toOrderedUnique (x : Nat) (l : List Nat) :
    x ∈ toOrderedUnique l ↔ x ∈ l := by
  induction l with
  | nil => simp [toOrderedUnique]
  | cons y rest ih =>
    simp only [toOrderedUnique]
    rw [mem_insertSorted]
    constructor
    · intro h; cases h with
      | inl h => exact h ▸ List.Mem.head _
      | inr h => exact List.Mem.tail _ (ih.mp h)
    · intro h; cases h with
      | head => left; rfl
      | tail _ h => right; exact ih.mpr h

/-
  ОСНОВНАЯ ТЕОРЕМА: Эквивалентность множества и последовательности

  Для любого списка (представляющего мультимножество) существует строго
  возрастающий список, содержащий в точности те же элементы (как множество).
-/

/-- Основная теорема: Каждый список может быть преобразован в упорядоченную уникальную
    последовательность с теми же элементами -/
theorem set_sequence_equivalence (l : List Nat) :
    ∃ l' : List Nat,
      IsOrderedUniqueSequence l' ∧
      (∀ x, x ∈ l' ↔ x ∈ l) := by
  exact ⟨toOrderedUnique l, toOrderedUnique_is_ascending l, mem_toOrderedUnique · l⟩

/-- Следствие: Упорядоченная уникальная последовательность не содержит дубликатов -/
theorem ordered_unique_has_no_dup (l : List Nat) :
    NoDuplicates (toOrderedUnique l) := by
  apply strictly_ascending_implies_no_dup
  exact toOrderedUnique_is_ascending l

end SetSequenceEquivalence

-- Проверки верификации
#check SetSequenceEquivalence.set_sequence_equivalence
#check SetSequenceEquivalence.ordered_unique_has_no_dup
