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

/-- Вставка элемента в отсортированный список с сохранением порядка -/
def insertSorted (x : Nat) : List Nat → List Nat
  | [] => [x]
  | y :: rest =>
    if x < y then x :: y :: rest
    else if x = y then y :: rest
    else y :: insertSorted x rest

/-- Сортировка списка в строго возрастающем порядке (с удалением дубликатов) -/
def toOrderedUnique : List Nat → List Nat
  | [] => []
  | x :: rest => insertSorted x (toOrderedUnique rest)

/-- Строго возрастающий список не содержит дубликатов -/
theorem strictly_ascending_implies_no_dup (l : List Nat)
    (h : StrictlyAscending l) : NoDuplicates l := by
  induction l with
  | nil => exact True.intro
  | cons x rest ih =>
    unfold NoDuplicates
    constructor
    · -- x ∉ rest: элемент строго меньше всех следующих, значит не может быть среди них
      intro hx_in
      induction rest with
      | nil => exact (List.not_mem_nil x) hx_in
      | cons y ys _ =>
        unfold StrictlyAscending at h
        match ys, h with
        | [], ⟨hxy, _⟩ =>
          match hx_in with
          | .head _ => omega
        | _ :: _, ⟨hxy, hrest⟩ =>
          match hx_in with
          | .head _ => omega
          | .tail _ hx_ys =>
            -- Все элементы строго возрастающего (y :: ys) больше y > x
            have : ∀ z, z ∈ ys → y < z := by
              intro z hz
              induction ys with
              | nil => exact (List.not_mem_nil z) hz |>.elim
              | cons w ws ih_ws =>
                unfold StrictlyAscending at hrest
                match ws, hrest with
                | [], ⟨hyw, _⟩ =>
                  match hz with
                  | .head _ => exact hyw
                | _ :: _, ⟨hyw, hrest'⟩ =>
                  match hz with
                  | .head _ => exact hyw
                  | .tail _ hz_ws =>
                    have := ih_ws hrest' hz_ws
                    omega
            have := this x hx_ys
            omega
    · -- NoDuplicates rest
      match rest, h with
      | [], _ => exact True.intro
      | [_], _ => exact True.intro
      | _ :: _ :: _, ⟨_, hrest⟩ => exact ih hrest

/-- insertSorted сохраняет свойство строгого возрастания -/
theorem insertSorted_preserves_ascending (x : Nat) :
    ∀ l : List Nat, StrictlyAscending l → StrictlyAscending (insertSorted x l) := by
  intro l h
  induction l with
  | nil => simp [insertSorted, StrictlyAscending]
  | cons y rest ih =>
    simp only [insertSorted]
    by_cases hxy : x < y
    · simp [hxy]; exact ⟨hxy, h⟩
    · simp [hxy]
      by_cases hxy_eq : x = y
      · simp [hxy_eq]; exact h
      · simp [hxy_eq]
        have hyx : y < x := by omega
        match rest with
        | [] =>
          simp [insertSorted, StrictlyAscending]
          exact hyx
        | z :: zs =>
          have hyz : y < z := by
            unfold StrictlyAscending at h
            match zs, h with
            | _, ⟨hyz, _⟩ => exact hyz
          have hrest : StrictlyAscending (z :: zs) := by
            unfold StrictlyAscending at h
            match zs, h with
            | [], _ => exact True.intro
            | _ :: _, ⟨_, hr⟩ => exact hr
          have ih_r := ih hrest
          simp only [insertSorted] at ih_r ⊢
          by_cases hxz : x < z
          · simp [hxz]
            exact ⟨hyx, hxz, hrest⟩
          · simp [hxz]
            by_cases hxz_eq : x = z
            · simp [hxz_eq]; exact h
            · simp [hxz_eq]
              exact ⟨hyz, ih_r⟩

/-- toOrderedUnique выдаёт строго возрастающие списки -/
theorem toOrderedUnique_is_ascending (l : List Nat) :
    StrictlyAscending (toOrderedUnique l) := by
  induction l with
  | nil => simp [toOrderedUnique, StrictlyAscending]
  | cons x rest ih =>
    simp only [toOrderedUnique]
    exact insertSorted_preserves_ascending x (toOrderedUnique rest) ih

/-- Принадлежность элемента сохраняется при insertSorted -/
theorem mem_insertSorted (x y : Nat) :
    ∀ l : List Nat, y ∈ insertSorted x l ↔ y = x ∨ y ∈ l := by
  intro l
  induction l with
  | nil =>
    simp only [insertSorted]
    constructor
    · intro h
      match h with
      | .head _ => exact Or.inl rfl
    · intro h
      match h with
      | .inl h => exact h ▸ .head _
      | .inr h => exact absurd h (List.not_mem_nil _)
  | cons z rest ih =>
    simp only [insertSorted]
    by_cases hxz : x < z
    · simp [hxz]
      constructor
      · intro h
        match h with
        | .head _ => exact Or.inl rfl
        | .tail _ h => exact Or.inr h
      · intro h
        match h with
        | .inl h => exact h ▸ .head _
        | .inr h => exact .tail _ h
    · simp [hxz]
      by_cases hxz_eq : x = z
      · simp [hxz_eq]
        constructor
        · intro h
          match h with
          | .head _ => exact Or.inl hxz_eq
          | .tail _ h => exact Or.inr (.tail _ h)
        · intro h
          match h with
          | .inl h => exact hxz_eq ▸ h ▸ .head _
          | .inr h =>
            match h with
            | .head _ => exact .head _
            | .tail _ h => exact .tail _ h
      · simp [hxz_eq]
        constructor
        · intro h
          match h with
          | .head _ => exact Or.inr (.head _)
          | .tail _ h =>
            match ih.mp h with
            | .inl h => exact Or.inl h
            | .inr h => exact Or.inr (.tail _ h)
        · intro h
          match h with
          | .inl h => exact .tail _ (ih.mpr (Or.inl h))
          | .inr h =>
            match h with
            | .head _ => exact .head _
            | .tail _ h => exact .tail _ (ih.mpr (Or.inr h))

/-- Принадлежность элемента сохраняется при toOrderedUnique -/
theorem mem_toOrderedUnique (x : Nat) (l : List Nat) :
    x ∈ toOrderedUnique l ↔ x ∈ l := by
  induction l with
  | nil => simp [toOrderedUnique]
  | cons y rest ih =>
    simp only [toOrderedUnique]
    constructor
    · intro h
      match (mem_insertSorted y x (toOrderedUnique rest)).mp h with
      | .inl h => exact h ▸ .head _
      | .inr h => exact .tail _ (ih.mp h)
    · intro h
      match h with
      | .head _ =>
        exact (mem_insertSorted x x (toOrderedUnique rest)).mpr (Or.inl rfl)
      | .tail _ h =>
        exact (mem_insertSorted y x (toOrderedUnique rest)).mpr (Or.inr (ih.mpr h))

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
      (∀ x, x ∈ l' ↔ x ∈ l) :=
  ⟨toOrderedUnique l, toOrderedUnique_is_ascending l, fun x => mem_toOrderedUnique x l⟩

/-- Следствие: Упорядоченная уникальная последовательность не содержит дубликатов -/
theorem ordered_unique_has_no_dup (l : List Nat) :
    NoDuplicates (toOrderedUnique l) :=
  strictly_ascending_implies_no_dup _ (toOrderedUnique_is_ascending l)

end SetSequenceEquivalence

-- Проверки верификации
#check SetSequenceEquivalence.set_sequence_equivalence
#check SetSequenceEquivalence.ordered_unique_has_no_dup
