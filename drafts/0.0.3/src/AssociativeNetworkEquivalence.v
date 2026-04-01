Require Import PeanoNat.
Require Import Coq.Init.Nat.
Require Import Vector.
Require Import List.
Require Import Coq.Init.Datatypes.
Import ListNotations.
Import VectorNotations.
Require Import AssociativeNetworkDefinitions.
Require Import AssociativeNetworkConversions.

(* Предикат эквивалентности двух ассоциативных сетей векторов длины n,
   anet1 и anet2 типа AssociativeNetworkVectorFunction.

   Данный предикат описывает свойство «эквивалентности» для таких сетей.
   Он утверждает, что anet1 и anet2 считаются «эквивалентными», если для каждой ссылки id вектор,
   связанный с id в anet1, точно совпадает с вектором, связанным с тем же id в anet2.
*)
Definition VectorFunctionEquivalence {n: nat} (anet1: AssociativeNetworkVectorFunction n) (anet2: AssociativeNetworkVectorFunction n) : Prop :=
  forall id, anet1 id = anet2 id.

(* Предикат эквивалентности двух ассоциативных сетей векторов длины n,
   anet1 и anet2 типа AssociativeNetworkVectorList.
*)
Definition VectorListEquivalence {n: nat} (anet1: AssociativeNetworkVectorList n) (anet2: AssociativeNetworkVectorList n) : Prop :=
  anet1 = anet2.

(* Предикат эквивалентности для ассоциативных сетей дуплетов AssociativeNetworkDupletFunction *)
Definition DupletFunctionEquivalence (anet1: AssociativeNetworkDupletFunction) (anet2: AssociativeNetworkDupletFunction) : Prop := forall id, anet1 id = anet2 id.

(* Предикат эквивалентности для ассоциативных сетей дуплетов AssociativeNetworkDupletList *)
Definition DupletListEquivalence (anet1: AssociativeNetworkDupletList) (anet2: AssociativeNetworkDupletList) : Prop := anet1 = anet2.
