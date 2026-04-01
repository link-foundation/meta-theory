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
def TupleOfLinksDefault (n : Nat) : TupleOfLinks n := Vector.mkVector n LinkDefault

-- Множество всех ассоциаций: Association = Link × TupleOfLinks
abbrev Association (n : Nat) := Link × TupleOfLinks n

-- Ассоциативная сеть кортежей длины n (или n-мерная ассоциативная сеть) из семейства функций {anetvⁿ : Link → TupleOfLinks}
abbrev AssociativeNetworkTupleFunction (n : Nat) := Link → TupleOfLinks n

-- Ассоциативная сеть кортежей длины n (или n-мерная ассоциативная сеть) в виде последовательности
abbrev AssociativeNetworkTupleList (n : Nat) := List (TupleOfLinks n)

-- Вложенные упорядоченные пары
abbrev NestedPair := List Link

-- Ассоциативная сеть вложенных упорядоченных пар: anetl : Link → NestedPair
abbrev AssociativeNetworkNestedPairFunction := Link → NestedPair

-- Ассоциативная сеть вложенных упорядоченных пар в виде последовательности вложенных упорядоченных пар
abbrev AssociativeNetworkNestedPairList := List NestedPair

-- Дуплет ссылок
abbrev Duplet := Link × Link

-- Значение Duplet по умолчанию: пара из двух LinkDefault, используется для обозначения пустого дуплета
def DupletDefault : Duplet := (LinkDefault, LinkDefault)

-- Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть): anetd : Link → Link²
abbrev AssociativeNetworkDupletFunction := Link → Duplet

-- Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть) в виде последовательности дуплетов
abbrev AssociativeNetworkDupletList := List Duplet
