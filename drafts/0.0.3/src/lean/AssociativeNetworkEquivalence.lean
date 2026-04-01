/-
  AssociativeNetworkEquivalence.lean

  Предикаты эквивалентности для различных представлений сетей.
  Lean 4 перевод AssociativeNetworkEquivalence.v (Rocq).
-/
import AssociativeNetworkDefinitions
import AssociativeNetworkConversions

-- Предикат эквивалентности двух сетей кортежей длины n,
-- anet1 и anet2 типа AssociativeNetworkTupleFunction.
--
-- Данный предикат описывает свойство «эквивалентности» для таких сетей.
-- Он утверждает, что anet1 и anet2 считаются «эквивалентными», если для каждой ссылки id кортеж,
-- связанный с id в anet1, точно совпадает с кортежем, связанным с тем же id в anet2.
def TupleFunctionEquivalence {n : Nat} (anet1 anet2 : AssociativeNetworkTupleFunction n) : Prop :=
  ∀ id, anet1 id = anet2 id

-- Предикат эквивалентности двух сетей кортежей длины n,
-- anet1 и anet2 типа AssociativeNetworkTupleList.
def TupleListEquivalence {n : Nat} (anet1 anet2 : AssociativeNetworkTupleList n) : Prop :=
  anet1 = anet2

-- Предикат эквивалентности для сетей дуплетов AssociativeNetworkDupletFunction
def DupletFunctionEquivalence (anet1 anet2 : AssociativeNetworkDupletFunction) : Prop :=
  ∀ id, anet1 id = anet2 id

-- Предикат эквивалентности для сетей дуплетов AssociativeNetworkDupletList
def DupletListEquivalence (anet1 anet2 : AssociativeNetworkDupletList) : Prop :=
  anet1 = anet2
