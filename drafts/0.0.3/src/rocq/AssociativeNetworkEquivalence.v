Require Import PeanoNat.
Require Import Coq.Init.Nat.
Require Import Vector.
Require Import List.
Require Import Coq.Init.Datatypes.
Import ListNotations.
Import VectorNotations.
Require Import AssociativeNetworkDefinitions.
Require Import AssociativeNetworkConversions.

(* Предикат эквивалентности двух сетей кортежей длины n,
   anet1 и anet2 типа AssociativeNetworkTupleFunction.

   Данный предикат описывает свойство «эквивалентности» для таких сетей.
   Он утверждает, что anet1 и anet2 считаются «эквивалентными», если для каждой ссылки id кортеж,
   связанный с id в anet1, точно совпадает с кортежем, связанным с тем же id в anet2.
*)
Definition TupleFunctionEquivalence {n: nat} (anet1: AssociativeNetworkTupleFunction n) (anet2: AssociativeNetworkTupleFunction n) : Prop :=
  forall id, anet1 id = anet2 id.

(* Предикат эквивалентности двух сетей кортежей длины n,
   anet1 и anet2 типа AssociativeNetworkTupleList.
*)
Definition TupleListEquivalence {n: nat} (anet1: AssociativeNetworkTupleList n) (anet2: AssociativeNetworkTupleList n) : Prop :=
  anet1 = anet2.

(* Предикат эквивалентности для сетей дуплетов AssociativeNetworkDupletFunction *)
Definition DupletFunctionEquivalence (anet1: AssociativeNetworkDupletFunction) (anet2: AssociativeNetworkDupletFunction) : Prop := forall id, anet1 id = anet2 id.

(* Предикат эквивалентности для сетей дуплетов AssociativeNetworkDupletList *)
Definition DupletListEquivalence (anet1: AssociativeNetworkDupletList) (anet2: AssociativeNetworkDupletList) : Prop := anet1 = anet2.
