/-
  AssociativeNetworkDefinitions.lean

  Определения основных типов для ассоциативных сетей.
  Lean 4 перевод AssociativeNetworkDefinitions.v (Rocq).
-/

-- Множество ссылок на кортежи: L ⊆ ℕ₀
abbrev Link := Nat

-- Значение Link по умолчанию: ноль
def LinkDefault : Link := 0

-- Множество кортежей ссылок длины n ∈ ℕ₀: TupleOfLinks ⊆ Lⁿ
abbrev TupleOfLinks (n : Nat) := Vector Link n

-- Значение TupleOfLinks по умолчанию
def TupleOfLinksDefault (n : Nat) : TupleOfLinks n := Vector.replicate n LinkDefault

-- Список ссылок (ранее NestedPair — вложенные упорядоченные пары): LinkList ⊆ List(L)
abbrev LinkList := List Link

-- Ассоциативная сеть списков ссылок: anetl : Link → LinkList
abbrev AssociativeNetworkLinkListFunction := Link → LinkList

-- Ассоциативная сеть списков ссылок в виде последовательности списков ссылок
abbrev AssociativeNetworkLinkListList := List LinkList

-- Множество всех ассоциаций: Association = Link × TupleOfLinks
abbrev Association (n : Nat) := Link × TupleOfLinks n

-- Ассоциативная сеть кортежей длины n (или n-мерная ассоциативная сеть) из семейства функций {anetvⁿ : Link → TupleOfLinks}
abbrev AssociativeNetworkTupleFunction (n : Nat) := Link → TupleOfLinks n

-- Ассоциативная сеть кортежей длины n (или n-мерная ассоциативная сеть) в виде последовательности
abbrev AssociativeNetworkTupleList (n : Nat) := List (TupleOfLinks n)

-- Дуплет ссылок: упорядоченная пара (Link, Link).
-- В нотации связей (https://github.com/link-foundation/links-notation):
-- дуплет записывается как (id: from to), например (3: 1 2)
abbrev Duplet := Link × Link

-- Значение Duplet по умолчанию: пара из двух LinkDefault, используется для обозначения пустого дуплета
def DupletDefault : Duplet := (LinkDefault, LinkDefault)

-- Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть): anetd : Link → Link²
abbrev AssociativeNetworkDupletFunction := Link → Duplet

-- Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть) в виде последовательности дуплетов
abbrev AssociativeNetworkDupletList := List Duplet
