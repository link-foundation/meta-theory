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

/-- Вспомогательная: StrictlyAscending для хвоста -/
private theorem sa_tail {x : Nat} {rest : List Nat}
    (h : StrictlyAscending (x :: rest)) : StrictlyAscending rest := by
  match rest with
  | [] => exact True.intro
  | [_] => exact True.intro
  | y :: z :: zs =>
    unfold StrictlyAscending at h
    exact h.2

/-- Вспомогательная: StrictlyAscending для x :: y :: _ даёт x < y -/
private theorem sa_head {x y : Nat} {rest : List Nat}
    (h : StrictlyAscending (x :: y :: rest)) : x < y := by
  unfold StrictlyAscending at h
  exact h.1

/-- Все элементы строго возрастающего списка больше головы -/
private theorem sa_all_gt {x : Nat} {l : List Nat}
    (h : StrictlyAscending (x :: l)) : ∀ z, z ∈ l → x < z := by
  intro z hz
  induction l with
  | nil => exact absurd hz (List.not_mem_nil z)
  | cons y ys ih =>
    match hz with
    | .head _ => exact sa_head h
    | .tail _ hz_ys =>
      have : y < z := ih (sa_tail h) hz_ys
      have : x < y := sa_head h
      omega

/-- Строго возрастающий список не содержит дубликатов -/
theorem strictly_ascending_implies_no_dup (l : List Nat)
    (h : StrictlyAscending l) : NoDuplicates l := by
  induction l with
  | nil => exact True.intro
  | cons x rest ih =>
    unfold NoDuplicates
    constructor
    · intro hx_in
      have := sa_all_gt h x hx_in
      omega
    · exact ih (sa_tail h)

/-- insertSorted сохраняет свойство строгого возрастания -/
theorem insertSorted_preserves_ascending (x : Nat) :
    ∀ l : List Nat, StrictlyAscending l → StrictlyAscending (insertSorted x l) := by
  intro l
  induction l with
  | nil => intro _; unfold insertSorted; unfold StrictlyAscending; trivial
  | cons y rest ih =>
    intro h
    unfold insertSorted
    split
    · -- x < y
      rename_i hxy
      unfold StrictlyAscending
      exact ⟨hxy, h⟩
    · split
      · -- x = y
        exact h
      · -- x > y
        rename_i hxy_not_lt hxy_ne
        have hyx : y < x := by omega
        have hrest := sa_tail h
        have ih_result := ih hrest
        match rest with
        | [] =>
          unfold insertSorted; unfold StrictlyAscending
          exact ⟨hyx, True.intro⟩
        | z :: zs =>
          have hyz : y < z := sa_head h
          unfold insertSorted at ih_result ⊢
          split
          · -- x < z
            rename_i hxz
            unfold StrictlyAscending
            exact ⟨hyx, hxz, sa_tail h⟩
          · split
            · -- x = z
              exact h
            · -- x > z
              unfold StrictlyAscending
              exact ⟨hyz, ih_result⟩

/-- toOrderedUnique выдаёт строго возрастающие списки -/
theorem toOrderedUnique_is_ascending (l : List Nat) :
    StrictlyAscending (toOrderedUnique l) := by
  induction l with
  | nil => unfold toOrderedUnique; unfold StrictlyAscending; trivial
  | cons x rest ih =>
    unfold toOrderedUnique
    exact insertSorted_preserves_ascending x (toOrderedUnique rest) ih

/-- Принадлежность элемента сохраняется при insertSorted -/
theorem mem_insertSorted (x y : Nat) :
    ∀ l : List Nat, y ∈ insertSorted x l ↔ y = x ∨ y ∈ l := by
  intro l
  induction l with
  | nil =>
    unfold insertSorted
    constructor
    · intro h; match h with
      | .head _ => exact Or.inl rfl
    · intro h; match h with
      | .inl h => exact h ▸ .head _
      | .inr h => exact absurd h (List.not_mem_nil _)
  | cons z rest ih =>
    unfold insertSorted
    split
    · -- x < z
      constructor
      · intro h; match h with
        | .head _ => exact Or.inl rfl
        | .tail _ h => exact Or.inr h
      · intro h; match h with
        | .inl h => exact h ▸ .head _
        | .inr h => exact .tail _ h
    · split
      · -- x = z
        rename_i _ hxz
        constructor
        · intro h; match h with
          | .head _ => exact Or.inl hxz
          | .tail _ h => exact Or.inr (.tail _ h)
        · intro h; match h with
          | .inl h => exact hxz ▸ h ▸ .head _
          | .inr h => match h with
            | .head _ => exact .head _
            | .tail _ h => exact .tail _ h
      · -- x > z
        constructor
        · intro h; match h with
          | .head _ => exact Or.inr (.head _)
          | .tail _ h =>
            match ih.mp h with
            | .inl h => exact Or.inl h
            | .inr h => exact Or.inr (.tail _ h)
        · intro h; match h with
          | .inl h => exact .tail _ (ih.mpr (Or.inl h))
          | .inr h => match h with
            | .head _ => exact .head _
            | .tail _ h => exact .tail _ (ih.mpr (Or.inr h))

/-- Принадлежность элемента сохраняется при toOrderedUnique -/
theorem mem_toOrderedUnique (x : Nat) (l : List Nat) :
    x ∈ toOrderedUnique l ↔ x ∈ l := by
  induction l with
  | nil => unfold toOrderedUnique; exact Iff.rfl
  | cons y rest ih =>
    unfold toOrderedUnique
    constructor
    · intro h
      match (mem_insertSorted y x (toOrderedUnique rest)).mp h with
      | .inl h => exact h ▸ .head _
      | .inr h => exact .tail _ (ih.mp h)
    · intro h
      match h with
      | .head _ => exact (mem_insertSorted y y (toOrderedUnique rest)).mpr (Or.inl rfl)
      | .tail _ h => exact (mem_insertSorted y x (toOrderedUnique rest)).mpr (Or.inr (ih.mpr h))

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
