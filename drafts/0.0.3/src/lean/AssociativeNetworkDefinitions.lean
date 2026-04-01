/-
  AssociativeNetworkDefinitions.lean

  Определения основных типов для ассоциативных сетей.
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

-- Список ссылок (ранее NestedPair — вложенные упорядоченные пары): ReferenceList ⊆ List(R)
abbrev ReferenceList := List Reference

-- Ассоциативная сеть списков ссылок: anetl : Reference → ReferenceList
abbrev AssociativeNetworkReferenceListFunction := Reference → ReferenceList

-- Ассоциативная сеть списков ссылок в виде последовательности списков ссылок
abbrev AssociativeNetworkReferenceListList := List ReferenceList

-- Множество всех связей: Link = Reference × TupleOfReferences
abbrev Link (n : Nat) := Reference × TupleOfReferences n

-- Ассоциативная сеть кортежей длины n (или n-мерная ассоциативная сеть) из семейства функций {anetvⁿ : Reference → TupleOfReferences}
abbrev AssociativeNetworkTupleFunction (n : Nat) := Reference → TupleOfReferences n

-- Ассоциативная сеть кортежей длины n (или n-мерная ассоциативная сеть) в виде последовательности
abbrev AssociativeNetworkTupleList (n : Nat) := List (TupleOfReferences n)

-- Дуплет ссылок: упорядоченная пара (Reference, Reference).
-- В нотации связей (https://github.com/link-foundation/links-notation):
-- дуплет записывается как (id: from to), например (3: 1 2)
abbrev Duplet := Reference × Reference

-- Значение Duplet по умолчанию: пара из двух ReferenceDefault, используется для обозначения пустого дуплета
def DupletDefault : Duplet := (ReferenceDefault, ReferenceDefault)

-- Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть): anetd : Reference → Reference²
abbrev AssociativeNetworkDupletFunction := Reference → Duplet

-- Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть) в виде последовательности дуплетов
abbrev AssociativeNetworkDupletList := List Duplet
