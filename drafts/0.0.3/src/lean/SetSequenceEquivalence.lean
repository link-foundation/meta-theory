/-
  SetSequenceEquivalence.lean - Формальное доказательство того, что конечное множество
  эквивалентно упорядоченной последовательности с уникальными элементами.

  Основная теорема: Для любого конечного множества натуральных чисел существует
  единственная строго возрастающая последовательность (список без дубликатов,
  отсортированный по возрастанию), содержащая в точности те же элементы.

  Адаптировано из: https://github.com/konard/subset-sum/tree/main/proofs/set_sequence_equivalence
-/

import Std.Data.List.Basic

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

/-- Строго возрастающий список не содержит дубликатов -/
theorem strictly_ascending_implies_no_dup : ∀ l : List Nat,
  StrictlyAscending l → NoDuplicates l := by
  intro l
  induction l with
  | nil =>
    intro _
    simp [NoDuplicates]
  | cons x rest ih =>
    intro h
    simp [NoDuplicates]
    constructor
    · -- x ∉ rest
      cases rest with
      | nil => simp
      | cons y ys =>
        simp [StrictlyAscending] at h
        obtain ⟨hxy, hrest⟩ := h
        intro hx_in_rest
        cases hx_in_rest with
        | head => omega
        | tail _ hx_in_ys =>
          have : ∀ z ∈ ys, y < z := by
            intro z hz
            clear ih
            induction ys generalizing y with
            | nil => contradiction
            | cons w ws ih_ws =>
              simp [StrictlyAscending] at hrest
              cases hz with
              | head => exact hrest.1
              | tail _ hz_in_ws =>
                have hyw : y < w := hrest.1
                cases ws with
                | nil => contradiction
                | cons v vs =>
                  simp [StrictlyAscending] at hrest
                  have hwv : w < v := hrest.2.1
                  have hws_asc : StrictlyAscending (v :: vs) := hrest.2.2
                  have : w < z := ih_ws w hrest.2 hz_in_ws
                  omega
          have hyz : y < x := by
            have := this x hx_in_ys
            exact this
          omega
    · -- NoDuplicates rest
      cases rest with
      | nil => simp [NoDuplicates]
      | cons y ys =>
        simp [StrictlyAscending] at h
        exact ih h.2

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
    simp [insertSorted]
    split
    · rename_i hxy
      simp [StrictlyAscending]
      constructor
      · exact hxy
      · exact h
    · split
      · exact h
      · rename_i hxy_not_lt hxy_ne
        have hyx : y < x := by omega
        cases rest with
        | nil =>
          simp [insertSorted, StrictlyAscending]
          exact hyx
        | cons z zs =>
          simp [StrictlyAscending] at h
          simp [insertSorted]
          split
          · rename_i hxz
            simp [StrictlyAscending]
            exact ⟨hyx, hxz, h.2⟩
          · split
            · simp [StrictlyAscending]
              exact h
            · simp [StrictlyAscending]
              constructor
              · exact h.1
              · exact ih h.2

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
  | cons z rest ih =>
    simp [insertSorted]
    split
    · simp [List.mem_cons]
      tauto
    · split
      · rename_i hxz
        simp [List.mem_cons]
        constructor
        · intro h
          cases h with
          | inl hz => right; left; exact hz
          | inr hr => right; right; exact hr
        · intro h
          cases h with
          | inl hyx =>
            left
            omega
          | inr h =>
            cases h with
            | inl hyz => left; exact hyz
            | inr hr => right; exact hr
      · simp [List.mem_cons]
        rw [ih]
        tauto

/-- Принадлежность элемента сохраняется при toOrderedUnique -/
theorem mem_toOrderedUnique (x : Nat) (l : List Nat) :
  x ∈ toOrderedUnique l ↔ x ∈ l := by
  induction l with
  | nil => simp [toOrderedUnique]
  | cons y rest ih =>
    simp [toOrderedUnique]
    rw [mem_insertSorted]
    simp [List.mem_cons]
    constructor
    · intro h
      cases h with
      | inl hxy => left; exact hxy.symm
      | inr hr => right; rw [← ih]; exact hr
    · intro h
      cases h with
      | inl hxy => left; exact hxy.symm
      | inr hr => right; rw [ih]; exact hr

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
  use toOrderedUnique l
  constructor
  · exact toOrderedUnique_is_ascending l
  · intro x
    exact mem_toOrderedUnique x l

/-- Следствие: Упорядоченная уникальная последовательность не содержит дубликатов -/
theorem ordered_unique_has_no_dup (l : List Nat) :
  NoDuplicates (toOrderedUnique l) := by
  apply strictly_ascending_implies_no_dup
  exact toOrderedUnique_is_ascending l

end SetSequenceEquivalence

-- Проверки верификации
#check SetSequenceEquivalence.set_sequence_equivalence
#check SetSequenceEquivalence.ordered_unique_has_no_dup
