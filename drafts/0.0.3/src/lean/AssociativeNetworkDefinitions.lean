/-
  AssociativeNetworkDefinitions.lean

  Определения основных типов для ассоциативных сетей.
  Lean 4 перевод AssociativeNetworkDefinitions.v (Rocq).
-/

-- Множество ссылок на кортежи: L ⊆ ℕ₀
def Link := Nat

-- Значение Link по умолчанию: ноль
def LinkDefault : Link := 0

-- Множество кортежей ссылок длины n ∈ ℕ₀: TupleOfLinks ⊆ Lⁿ
def TupleOfLinks (n : Nat) := Vector Link n

-- Значение TupleOfLinks по умолчанию
def TupleOfLinksDefault (n : Nat) : TupleOfLinks n := Vector.replicate n LinkDefault

-- Множество всех ассоциаций: Association = Link × TupleOfLinks
def Association (n : Nat) := Link × TupleOfLinks n

-- Ассоциативная сеть кортежей длины n (или n-мерная ассоциативная сеть) из семейства функций {anetvⁿ : Link → TupleOfLinks}
def AssociativeNetworkTupleFunction (n : Nat) := Link → TupleOfLinks n

-- Ассоциативная сеть кортежей длины n (или n-мерная ассоциативная сеть) в виде последовательности
def AssociativeNetworkTupleList (n : Nat) := List (TupleOfLinks n)

-- Вложенные упорядоченные пары
def NestedPair := List Link

-- Ассоциативная сеть вложенных упорядоченных пар: anetl : Link → NestedPair
def AssociativeNetworkNestedPairFunction := Link → NestedPair

-- Ассоциативная сеть вложенных упорядоченных пар в виде последовательности вложенных упорядоченных пар
def AssociativeNetworkNestedPairList := List NestedPair

-- Дуплет ссылок
def Duplet := Link × Link

-- Значение Duplet по умолчанию: пара из двух LinkDefault, используется для обозначения пустого дуплета
def DupletDefault : Duplet := (LinkDefault, LinkDefault)

-- Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть): anetd : Link → Link²
def AssociativeNetworkDupletFunction := Link → Duplet

-- Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть) в виде последовательности дуплетов
def AssociativeNetworkDupletList := List Duplet
