/-
  AssociativeNetworkDefinitions.lean

  Определения основных типов для сетей.
  Lean 4 перевод AssociativeNetworkDefinitions.v (Rocq).
-/

-- Ссылка (Reference) — уникальный идентификатор кортежа: R ⊆ ℕ₀
abbrev Reference := Nat

-- Значение Reference по умолчанию: ноль
def ReferenceDefault : Reference := 0

-- Множество кортежей ссылок длины n ∈ ℕ₀: TupleOfReferences ⊆ Rⁿ
abbrev TupleOfReferences (n : Nat) := Vector Reference n

-- Значение TupleOfReferences по умолчанию
def TupleOfReferencesDefault (n : Nat) : TupleOfReferences n := Vector.replicate n ReferenceDefault

-- Список ссылок: ReferenceList ⊆ List(R)
abbrev ReferenceList := List Reference

-- Сеть списков ссылок: N^{list} : Reference → ReferenceList
abbrev AssociativeNetworkReferenceListFunction := Reference → ReferenceList

-- Сеть списков ссылок в виде последовательности списков ссылок
abbrev AssociativeNetworkReferenceListList := List ReferenceList

-- Множество всех связей: Link = Reference × TupleOfReferences
abbrev Link (n : Nat) := Reference × TupleOfReferences n

-- Сеть кортежей длины n (или n-мерная сеть) из семейства функций {Nⁿ : Reference → TupleOfReferences}
abbrev AssociativeNetworkTupleFunction (n : Nat) := Reference → TupleOfReferences n

-- Сеть кортежей длины n (или n-мерная сеть) в виде последовательности
abbrev AssociativeNetworkTupleList (n : Nat) := List (TupleOfReferences n)

-- Дуплет ссылок: упорядоченная пара (Reference, Reference).
-- В нотации связей (https://github.com/link-foundation/links-notation):
-- дуплет записывается как (id: from to), например (3: 1 2)
abbrev Duplet := Reference × Reference

-- Значение Duplet по умолчанию: пара из двух ReferenceDefault, используется для обозначения пустого дуплета
def DupletDefault : Duplet := (ReferenceDefault, ReferenceDefault)

-- Сеть дуплетов (или двумерная сеть): N² : Reference → Reference²
abbrev AssociativeNetworkDupletFunction := Reference → Duplet

-- Сеть дуплетов (или двумерная сеть) в виде последовательности дуплетов
abbrev AssociativeNetworkDupletList := List Duplet
